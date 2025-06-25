import React from "react";
import { AppProviders, AppProvidersProps } from "@common/components/providers/AppProviders";

// Higher-order component for wrapping components with providers
export const withAppProviders = <P extends object>(
  Component: React.ComponentType<P>,
  providerOptions?: Omit<AppProvidersProps, "children">,
) => {
  const WrappedComponent = (props: P) => (
    <AppProviders {...providerOptions}>
      <Component {...props} />
    </AppProviders>
  );

  WrappedComponent.displayName = `withAppProviders(${Component.displayName || Component.name})`;
  return WrappedComponent;
};
