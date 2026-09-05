"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/empty-state";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("route.error_boundary", {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.title ?? "This section is temporarily unavailable"}
          description={
            this.props.description ??
            "Something went wrong while rendering this page. Other areas of the app remain available."
          }
          onRetry={() => this.setState({ hasError: false, message: undefined })}
        />
      );
    }

    return this.props.children;
  }
}
