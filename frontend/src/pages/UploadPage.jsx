import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';


export default function UploadPage() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [participantEmails, setParticipantEmails] = useState('');
    const [extractTasks, setExtractTasks] = useState(false);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();


    async function handleSubmit(e) {
        e.preventDefault();
        if (!file) {
            setError('Please select an audio or video file to upload.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const emailsArray = participantEmails
                .split(',')
                .map((email) => email.trim())
                .filter((email) => email.length > 0);
            const createResponse = await client.post('/meetings', {
                title, description, participant_emails: emailsArray, extract_tasks: extractTasks,
            });
            const meetingId = createResponse.data.id;

            const formData = new FormData();

            formData.append('file', file);

            await client.post(`/meetings/${meetingId}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            navigate(`/meetings/${meetingId}`);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create and upload meeting');
        }
        finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '30px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Upload New Meeting Recording</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Meeting Title *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="e.g. Q3 Sprint Planning"
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief overview of the meeting topics..."
                        rows={3}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Participant Emails (comma-separated)
                    </label>
                    <input
                        type="text"
                        value={participantEmails}
                        onChange={(e) => setParticipantEmails(e.target.value)}
                        placeholder="alex@example.com, sam@example.com"
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="checkbox"
                        id="extractTasks"
                        checked={extractTasks}
                        onChange={(e) => setExtractTasks(e.target.checked)}
                    />
                    <label htmlFor="extractTasks">Automatically extract action items/tasks with AI</label>
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Recording File (Audio/Video) *</label>
                    <input
                        type="file"
                        accept="audio/*,video/*"
                        onChange={(e) => setFile(e.target.files[0])}
                        required
                    />
                </div>
                <button type="submit" disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    {loading ? 'Uploading & Starting Pipeline...' : 'Create & Upload Meeting'}
                </button>
            </form>
        </div>
    );
}
