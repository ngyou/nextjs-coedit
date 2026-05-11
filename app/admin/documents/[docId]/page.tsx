import { redirect } from "next/navigation";

export default async function LegacyAdminDocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  redirect(`/admin/docs/${encodeURIComponent(docId)}`);
}

