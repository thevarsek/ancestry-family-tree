import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
    if (!CLERK_PUBLISHABLE_KEY) {
        return (
            <div className="app-loading">
                <div className="card card-raised" style={{ maxWidth: '400px' }}>
                    <div className="card-header">
                        <h3 className="card-title text-error">Configuration Warning</h3>
                    </div>
                    <p>
                        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code> environment variable.
                    </p>
                    <p className="text-sm text-muted">
                        Please check your <code>.env</code> file.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
}
