import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AdminBackButton() {
  return (
    <Link className="btn secondary min-h-10 px-3 text-sm" href="/admin">
      <ArrowLeft className="h-4 w-4" />
      Volver
    </Link>
  );
}
