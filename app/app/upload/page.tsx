import UploadForm from "./upload-form";

export default function UploadPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Upload tender document</h1>
      <UploadForm />
    </div>
  );
}
