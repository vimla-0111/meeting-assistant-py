import { Badge } from "@/components/ui/badge";

export default function StatusBadge({ status }) {
    const variants = {
        uploaded: "bg-slate-100 text-slate-700 hover:bg-slate-100",
        extracting_audio: "bg-blue-100 text-blue-800 hover:bg-blue-100",
        transcribing: "bg-blue-100 text-blue-800 hover:bg-blue-100",
        summarizing: "bg-amber-100 text-amber-800 hover:bg-amber-100",
        pending_approval: "bg-orange-100 text-orange-800 hover:bg-orange-100",
        approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
        failed: "bg-rose-100 text-rose-800 hover:bg-rose-100",
    };

    const className = variants[status] || "bg-gray-100 text-gray-800";

    return (
        <Badge className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${className}`}>
            {status ? status.replace(/_/g, " ") : "UNKNOWN"}
        </Badge>
    );
}
