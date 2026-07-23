import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, Users, AlignLeft } from 'lucide-react';
import client from '../api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-start justify-center">
            <Card className="w-full max-w-2xl shadow-md border-slate-200">
                <CardHeader className="space-y-2 border-b border-slate-100 bg-white rounded-t-xl pb-6">
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                        <UploadCloud className="text-primary size-6" />
                        Upload New Meeting
                    </CardTitle>
                    <CardDescription className="text-base">
                        Upload your recording and let AI transcribe and summarize it for you.
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-6 bg-slate-50/50">
                        {error && (
                            <div className="rounded-md bg-rose-50 p-4 text-sm font-medium text-rose-700 border border-rose-200">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            <Label htmlFor="title" className="text-sm font-semibold flex items-center gap-2">
                                Meeting Title <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                placeholder="e.g. Q3 Sprint Planning"
                                className="bg-white"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
                                <AlignLeft className="size-4 text-slate-400" />
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief overview of the meeting topics..."
                                rows={3}
                                className="bg-white resize-none"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="participants" className="text-sm font-semibold flex items-center gap-2">
                                <Users className="size-4 text-slate-400" />
                                Participant Emails
                            </Label>
                            <Input
                                id="participants"
                                type="text"
                                value={participantEmails}
                                onChange={(e) => setParticipantEmails(e.target.value)}
                                placeholder="alex@example.com, sam@example.com"
                                className="bg-white"
                            />
                            <p className="text-xs text-slate-500">Separate multiple emails with commas</p>
                        </div>

                        <div className="flex items-center space-x-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <Checkbox
                                id="extractTasks"
                                checked={extractTasks}
                                onCheckedChange={setExtractTasks}
                                className="data-[state=checked]:bg-primary"
                            />
                            <div className="space-y-1 leading-none">
                                <Label htmlFor="extractTasks" className="font-medium cursor-pointer">
                                    Extract Action Items
                                </Label>
                                <p className="text-sm text-slate-500">
                                    Automatically detect and extract tasks using AI
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="file" className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="size-4 text-slate-400" />
                                Recording File <span className="text-rose-500">*</span>
                            </Label>
                            <div className="flex items-center gap-4">
                                <Input
                                    id="file"
                                    type="file"
                                    accept="audio/*,video/*"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    required
                                    className="cursor-pointer file:cursor-pointer file:bg-primary/10 file:text-primary file:font-medium file:border-0 file:rounded-md file:mr-4 file:px-4 file:py-1 hover:file:bg-primary/20 bg-white"
                                />
                            </div>
                            <p className="text-xs text-slate-500">Supported formats: MP3, MP4, WAV, M4A</p>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6 rounded-b-xl">
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto ml-auto px-8 gap-2">
                            {loading ? (
                                <>
                                    <div className="size-4 rounded-full border-2 border-slate-300 border-t-white animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="size-4" />
                                    Create & Upload
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
