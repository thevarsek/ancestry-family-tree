import { SignInButton } from "@clerk/clerk-react";

export function SignIn() {
    return (
        <div className="app-loading">
            <div className="card card-raised text-center animate-fade-in" style={{ padding: '2rem', maxWidth: '400px' }}>
                <div className="mb-6">
                    <span style={{ fontSize: '3rem' }}>🌳</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
                <p className="text-muted mb-6">
                    Sign in to access your family trees and research.
                </p>
                <SignInButton mode="modal">
                    <button className="btn btn-primary btn-lg w-full justify-center">
                        Sign In with Clerk
                    </button>
                </SignInButton>
            </div>
        </div>
    );
}
