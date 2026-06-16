import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Merge every document the user owns into a single PDF, upload it to storage,
// and return a short-lived signed download URL.
export const mergeUserDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: docs, error: listErr } = await supabase
      .from("documents")
      .select("id, name, storage_path, mime_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (listErr) throw new Error(listErr.message);
    if (!docs || docs.length === 0) throw new Error("No documents to merge yet.");

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const merged = await PDFDocument.create();
    const font = await merged.embedFont(StandardFonts.HelveticaBold);
    const sub = await merged.embedFont(StandardFonts.Helvetica);

    // Cover page
    const cover = merged.addPage([612, 792]);
    cover.drawText("Medicaid Success", { x: 50, y: 720, size: 26, font, color: rgb(0.04, 0.30, 0.23) });
    cover.drawText("Compiled Document Packet", { x: 50, y: 690, size: 14, font: sub, color: rgb(0.3, 0.3, 0.3) });
    cover.drawText(`Generated: ${new Date().toUTCString()}`, { x: 50, y: 660, size: 10, font: sub, color: rgb(0.4, 0.4, 0.4) });
    cover.drawText(`Total source files: ${docs.length}`, { x: 50, y: 644, size: 10, font: sub, color: rgb(0.4, 0.4, 0.4) });
    cover.drawText("Contents", { x: 50, y: 600, size: 14, font, color: rgb(0.04, 0.30, 0.23) });
    let y = 580;
    for (let i = 0; i < docs.length && y > 60; i++) {
      const line = `${String(i + 1).padStart(3, "0")}.  ${docs[i].name.slice(0, 78)}`;
      cover.drawText(line, { x: 50, y, size: 10, font: sub, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;
    }

    for (const doc of docs) {
      const { data: blob, error: dlErr } = await supabase.storage.from("documents").download(doc.storage_path);
      if (dlErr || !blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const mime = (doc.mime_type ?? "").toLowerCase();

      try {
        if (mime.includes("pdf") || doc.name.toLowerCase().endsWith(".pdf")) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        } else if (mime.includes("png") || doc.name.toLowerCase().endsWith(".png")) {
          const img = await merged.embedPng(bytes);
          const page = merged.addPage([612, 792]);
          const { width, height } = img.scaleToFit(540, 720);
          page.drawImage(img, { x: (612 - width) / 2, y: (792 - height) / 2, width, height });
        } else if (
          mime.includes("jpeg") || mime.includes("jpg") ||
          doc.name.toLowerCase().endsWith(".jpg") || doc.name.toLowerCase().endsWith(".jpeg")
        ) {
          const img = await merged.embedJpg(bytes);
          const page = merged.addPage([612, 792]);
          const { width, height } = img.scaleToFit(540, 720);
          page.drawImage(img, { x: (612 - width) / 2, y: (792 - height) / 2, width, height });
        } else {
          const page = merged.addPage([612, 792]);
          page.drawText("Unsupported file (kept in your portal):", { x: 50, y: 720, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
          page.drawText(doc.name, { x: 50, y: 700, size: 12, font: sub, color: rgb(0.1, 0.1, 0.1) });
          page.drawText(`Type: ${doc.mime_type ?? "unknown"}`, { x: 50, y: 684, size: 10, font: sub, color: rgb(0.4, 0.4, 0.4) });
        }
      } catch (e) {
        const page = merged.addPage([612, 792]);
        page.drawText(`Could not include: ${doc.name}`, { x: 50, y: 720, size: 12, font, color: rgb(0.5, 0.1, 0.1) });
        page.drawText(String(e instanceof Error ? e.message : e).slice(0, 100), { x: 50, y: 700, size: 10, font: sub, color: rgb(0.4, 0.4, 0.4) });
      }
    }

    const out = await merged.save();
    const outPath = `${userId}/_merged/packet-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(outPath, out, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: signed, error: signErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(outPath, 60 * 10);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Could not create download link");

    await supabase.from("check_ins").insert({
      user_id: userId,
      title: "Document packet compiled",
      body: `Merged ${docs.length} file${docs.length === 1 ? "" : "s"} into a single PDF packet.`,
      status: "success",
    });

    return { url: signed.signedUrl, count: docs.length, path: outPath };
  });

const signedSchema = z.object({ path: z.string().min(1).max(512) });

export const getSignedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => signedSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.path.startsWith(`${userId}/`)) throw new Error("Forbidden");
    const { data: signed, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(data.path, 60 * 5);
    if (error || !signed) throw new Error(error?.message ?? "Could not create signed URL");
    return { url: signed.signedUrl };
  });