import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-lg font-medium text-slate-500 animate-pulse">Loading meetings...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="rounded-md bg-rose-50 p-4 text-sm font-medium text-rose-700 border border-rose-200">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Your Meetings</h2>
                        <p className="text-muted-foreground mt-1">Manage and review your recorded meetings.</p>
                    </div>
                    <Button onClick={() => navigate('/upload')} className="gap-2">
                        <Plus className="size-4" />
                        New Meeting
                    </Button>
                </div>

                {/* Content */}
                {meetings.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <div className="rounded-full bg-slate-100 p-4 mb-4">
                            <Plus className="size-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold">No meetings found</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">
                            You haven't uploaded any meetings yet. Click the button above to upload your first recording!
                        </p>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {meetings.map((meeting) => (
                            <Card 
                                key={meeting.id}
                                onClick={() => navigate(`/meetings/${meeting.id}`)}
                                className="cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all overflow-hidden group"
                            >
                                <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                            {meeting.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1">
                                            {meeting.description && meeting.description !== 'null'
                                                ? meeting.description
                                                : 'No description provided'}
                                        </p>
                                        <div className="text-xs text-slate-400 pt-1">
                                            Created on: {new Date(meeting.created_at).toLocaleDateString(undefined, { 
                                                year: 'numeric', month: 'short', day: 'numeric' 
                                            })}
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <StatusBadge status={meeting.status} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
