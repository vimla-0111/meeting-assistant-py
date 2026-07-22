import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ReactMarkdown from 'react-markdown';

export default function MeetingDetailPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState(null);
    const [editableSummary, setEditableSummary] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showRawTranscript, setShowRawTranscript] = useState(false);
    const [isEditing, setIsEditing] = useState(false)

    // Helper to fetch full meeting details
    async function fetchMeetingDetails() {
        try {
            const response = await client.get(`/meetings/${meetingId}`);
            setMeeting(response.data);
            setEditableSummary(response.data.summary_draft || '');

        } catch (e) {
            setError('Failed to load meeting details');
        } finally {
            setLoading(false);
        }
    }

    // 1. Initial Load & Polling Setup
    useEffect(() => {
        fetchMeetingDetails();
    }, [meetingId]);

    // 2. Poll status every 5 seconds if pipeline is still processing
    useEffect(() => {
        if (!meeting) {
            return;
        }
        const isProcessing = [
            'uploaded',
            'extracting_audio',
            'transcribing',
            'summarizing',
        ].includes(meeting.status);

        if (!isProcessing) {
            return;  // Stop polling once processing is finished or failed
        }

        const intervalId = setInterval(async () => {
            try {
                const response = await client.get(`/meetings/${meetingId}/status`);
                const newStatus = response.data.status;
                // If status changed from processing to finished/failed, re-fetch full meeting
                if (newStatus !== meeting.status) {
                    fetchMeetingDetails();
                }
            } catch (err) {
                console.error('Error polling status:', err);
            }

        }, 5000);

        return () => clearInterval(intervalId); // Cleanup interval on unmount
    }, [meeting, meetingId]);

    // 3. Save edited summary draft
    async function handleSaveSummary() {
        setSaving(true);
        try {
            await client.put(`/meetings/${meetingId}`, {
                summary_draft: editableSummary,
            });
            alert('Summary draft saved successfully!');
        } catch (err) {
            alert('Failed to save summary draft.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div style={{ padding: '20px' }}>Loading meeting details...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;
    if (!meeting) return <div style={{ padding: '20px' }}>Meeting not found.</div>;
    const isProcessing = ['uploaded', 'extracting_audio', 'transcribing', 'summarizing'].includes(meeting.status);
    return (
        <div style={{ maxWidth: '900px', margin: '30px auto', padding: '20px' }}>
            <button onClick={() => navigate('/dashboard')} style={{ marginBottom: '20px' }}>
                ← Back to Dashboard
            </button>
            {/* HEADER SECTION */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: '0 0 10px 0' }}>{meeting.title}</h1>
                    <p style={{ color: '#666', margin: '0 0 5px 0' }}>
                        {meeting.description && meeting.description !== 'null' ? meeting.description : 'No description provided'}
                    </p>
                    <small style={{ color: '#999' }}>
                        Created on: {new Date(meeting.created_at).toLocaleString()}
                    </small>
                </div>
                <StatusBadge status={meeting.status} />
            </div>
            {/* PIPELINE PROCESSING BANNER */}
            {isProcessing && (
                <div style={{ padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '6px', marginBottom: '20px' }}>
                    ⏳ <strong>AI Pipeline is processing this recording...</strong>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
                        Current stage: <code>{meeting.status}</code>. This page will automatically update every 5 seconds.
                    </p>
                </div>
            )}
            {/* FAILURE BANNER */}
            {meeting.status === 'failed' && (
                <div style={{ padding: '15px', backgroundColor: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '6px', color: '#c62828', marginBottom: '20px' }}>
                    ❌ <strong>Pipeline Failed:</strong> {meeting.failure_reason || 'Unknown error during processing.'}
                </div>
            )}
            {/* SUMMARY SECTION */}
            {/* SUMMARY SECTION */}
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0 }}>AI Summary</h3>

                    {!isProcessing && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {/* Button 1: Toggle Edit vs Preview */}
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                style={{ padding: '6px 12px', cursor: 'pointer' }}
                            >
                                {isEditing ? '👁️ View Preview' : '✏️ Edit Summary'}
                            </button>

                            {/* Button 2: Save / Approve Summary */}
                            <button
                                onClick={async () => {
                                    await handleSaveSummary();
                                    setIsEditing(false);
                                }}
                                disabled={saving}
                                style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', color: '#2e7d32' }}
                            >
                                {saving ? 'Saving...' : '✅ Save & Approve'}
                            </button>

                            {/* Button 3: Send Email Notification */}
                            <button
                                onClick={() => {
                                    const emails = meeting.participant_emails?.join(', ') || 'No emails specified';
                                    alert(`Sending email to participants: [${emails}]\n(Mailjet backend integration coming in Phase 2!)`);
                                }}
                                style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#e3f2fd', border: '1px solid #90caf9', color: '#1565c0' }}
                            >
                                📧 Send Email
                            </button>
                        </div>
                    )}
                </div>

                {isProcessing ? (
                    <p style={{ color: '#888' }}>Summary will appear here once processing completes...</p>
                ) : isEditing ? (
                    /* EDIT MODE (RAW TEXTAREA) */
                    <div>
                        <textarea
                            value={editableSummary}
                            onChange={(e) => setEditableSummary(e.target.value)}
                            rows={12}
                            style={{ width: '100%', padding: '10px', fontFamily: 'monospace', fontSize: '14px' }}
                        />
                    </div>
                ) : (
                    /* PREVIEW MODE (RENDERED MARKDOWN) */
                    <div style={{ lineHeight: '1.6', backgroundColor: '#fafafa', padding: '15px', borderRadius: '6px' }}>
                        <ReactMarkdown>{editableSummary || 'No summary available.'}</ReactMarkdown>
                    </div>
                )}
            </div>
            {/* EXTRACTED TASKS SECTION */}
            {meeting.extract_tasks && (
                <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                    <h3>Extracted Action Items / Tasks</h3>
                    {meeting.tasks_json && meeting.tasks_json.length > 0 ? (
                        <ul>
                            {meeting.tasks_json.map((task, idx) => (
                                <li key={idx} style={{ marginBottom: '10px' }}>
                                    <strong>{task.title}</strong>
                                    {task.assignee_email && <span> (Assignee: <em>{task.assignee_email}</em>)</span>}
                                    <p style={{ margin: '3px 0 0 0', color: '#555', fontSize: '14px' }}>{task.description}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p style={{ color: '#888' }}>No action items extracted or pending processing.</p>
                    )}
                </div>
            )}
            {/* RAW TRANSCRIPT SECTION */}
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '20px' }}>
                <button
                    onClick={() => setShowRawTranscript(!showRawTranscript)}
                    style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0, fontSize: '16px', fontWeight: 'bold' }}
                >
                    {showRawTranscript ? '▼ Hide Raw Transcript' : '▶ View Raw Transcript'}
                </button>
                {showRawTranscript && (
                    <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                        {meeting.transcript_raw || 'Transcript not available yet.'}
                    </div>
                )}
            </div>
        </div>
    );
}