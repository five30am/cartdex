"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCollectionModal } from "@/components/add-to-collection-modal";
import { toast } from "sonner";
import Link from "next/link";

interface Props {
  gameId: number;
}

export function AddToCollectionButton({ gameId }: Props) {
  const [open, setOpen] = useState(false);

  function handleSuccess(collectionId: number, collectionName: string) {
    toast.success(
      <span>
        Added to{" "}
        <Link href={`/collections/${collectionId}`} className="underline">
          {collectionName}
        </Link>
      </span>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-border text-muted-foreground hover:text-foreground hover:border-border"
      >
        <FolderPlus className="h-4 w-4 mr-2" />
        Add to Collection
      </Button>

      <AddToCollectionModal
        open={open}
        onClose={() => setOpen(false)}
        gameIds={[gameId]}
        onSuccess={handleSuccess}
      />
    </>
  );
}
