export default function StatusBadge({ status }) {
    // Define colors for each meeting pipeline state
    const statusColors = {
        uploaded: { bg: '#e0e0e0', color: '#333' },
        extracting_audio: { bg: '#e3f2fd', color: '#1976d2' },
        transcribing: { bg: '#bbdefb', color: '#0d47a1' },
        summarizing: { bg: '#fff9c4', color: '#f57f17' },
        pending_approval: { bg: '#ffe0b2', color: '#e65100' },
        approved: { bg: '#c8e6c9', color: '#2e7d32' },
        failed: { bg: '#ffcdd2', color: '#c62828' },
    };

    const style = statusColors[status] || { bg: '#eee', color: '#333' };

    return (
        <span
            style={{
                backgroundColor: style.bg,
                color: style.color,
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
            }}
        >
            {status ? status.replace('_', ' ') : 'UNKNOWN'}
        </span>
    );
}
