import { useState } from "react";
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await client.post('/auth/register', {
                name, email, password
            });
            navigate('/login');

        } catch (error) {
            setError(error.response?.data?.detail || 'Failed to register');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Create an Account</CardTitle>
                    <CardDescription>Enter your details to register for Meeting Assistant</CardDescription>
                </CardHeader>

                {/* Bind the form submission to our function */}
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4 pb-6">
                        {/* Display errors if they exist */}
                        {error && (
                            <div className="rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700 border border-rose-200">
                                {error}
                            </div>
                        )}

                        {/* Name Field */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Name</label>
                            <Input
                                type="text"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        {/* Email Field */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Email</label>
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        {/* Password Field */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4 pt-2">
                        {/* Submit Button */}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Registering..." : "Sign Up"}
                        </Button>

                        {/* Link back to login */}
                        <div className="text-center text-sm text-slate-600">
                            Already have an account?{" "}
                            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}