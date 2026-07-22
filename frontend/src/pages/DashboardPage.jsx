import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchMeetings() {
            try {
                const response = await client.get('/meetings');
                setMeetings(response.data);
            } catch (err) {
                setError(err.response?.data?.detail || 'Failed to fetch meetings');
            } finally {
                setLoading(false);
            }
        }

        fetchMeetings();
    }, []);

    if (loading) return <div style={{ padding: '20px' }}>Loading meetings...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Your Meetings</h2>
                <button onClick={() => navigate('/upload')} style={{ padding: '10px 15px', cursor: 'pointer' }}>
                    + New Meeting
                </button>
            </div>

            {meetings.length === 0 ? (
                <p>No meetings found. Click "+ New Meeting" to upload your first recording!</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {meetings.map((meeting) => (
                        <div
                            key={meeting.id}
                            onClick={() => navigate(`/meetings/${meeting.id}`)}
                            style={{
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                                padding: '15px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: '#fff',
                            }}
                        >
                            <div>
                                <h3 style={{ margin: '0 0 5px 0' }}>{meeting.title}</h3>
                                <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                                    {meeting.description && meeting.description !== 'null'
                                        ? meeting.description
                                        : 'No description provided'}
                                </p>
                                <small style={{ color: '#999' }}>
                                    Created on: {new Date(meeting.created_at).toLocaleDateString()}
                                </small>
                            </div>

                            <div>
                                <StatusBadge status={meeting.status} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
