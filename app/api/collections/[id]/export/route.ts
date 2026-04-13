import { NextRequest, NextResponse } from "next/server";
import { exportCollection } from "@/lib/services/export";
import { db } from "@/lib/db";
import { collections, collection_games } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Readable } from "stream";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const profileIdParam = url.searchParams.get("profileId");
    const profileId = profileIdParam ? parseInt(profileIdParam, 10) : 1; // default to first profile

    if (isNaN(profileId)) {
      return NextResponse.json({ error: "Invalid profileId" }, { status: 400 });
    }

    // Quick empty check before starting archive
    const gameCount = db
      .select({ count: count() })
      .from(collection_games)
      .where(eq(collection_games.collection_id, collectionId))
      .get();

    if (!gameCount || gameCount.count === 0) {
      return NextResponse.json(
        { error: "Collection is empty — add games before exporting" },
        { status: 422 }
      );
    }

    const { stream, filename } = await exportCollection(collectionId, profileId);

    // Convert Node.js PassThrough to Web ReadableStream
    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[collections/id/export] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("empty")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
