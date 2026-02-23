import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";
import posthog from "posthog-js";
import FeedbackButton from "../FeedbackButton";
import { getVersion } from "@tauri-apps/api/app";
import { config } from "@core/config";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        // Save errorInfo to state so we can show it in UI
        this.setState({ errorInfo });

        // don't capture errors when analytics is disabled or in dev mode
        if (config.analyticsEnabled && !config.isDev) {
            void getVersion().then((version) =>
                posthog.capture("app_errored", {
                    error_message: error.message,
                    error_name: error.name,
                    error_stack: error.stack,
                    component_stack: errorInfo.componentStack,
                    version,
                }),
            );
        }
    }

    private handleReload = () => {
        // Navigate to root route by updating window.location
        window.location.href = "/";

        // Reset error state
        this.setState({
            hasError: false,
            error: undefined,
            errorInfo: undefined,
        });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen p-4">
                    <div className="text-center max-w-md">
                        <h2 className="text-2xl font-bold mb-4">
                            Uh-oh! Something went wrong.
                        </h2>
                        {this.state.error && (
                            <p className="mb-6 text-muted-foreground">
                                Error: {this.state.error.message}
                            </p>
                        )}
                        <div className="flex items-center justify-center gap-6">
                            <FeedbackButton className="hover:bg-gray-100 p-2 rounded-md">
                                Send us a bug report
                            </FeedbackButton>
                            <Button onClick={this.handleReload}>
                                Go to Home Screen
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
