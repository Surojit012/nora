export type Post = {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  location?: string;
  scheduledAt?: string;
  poll?: {
    options: string[];
    endsAt?: string;
  };
  attachments?: {
    kind: "image" | "video" | "file";
    blobName: string;
    mimeType: string;
    size: number;
    url: string;
  }[];
  txHash?: string;
  txExplorerUrl?: string;
  shelbyTxExplorerUrl?: string;
  shelbyExplorerUrl?: string;
};
