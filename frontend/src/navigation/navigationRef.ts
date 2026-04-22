/**
 * A module-level navigation ref that can be used outside of React components
 * (e.g. in the Axios 401 interceptor).
 *
 * Pass this ref to NavigationContainer's `ref` prop in RootNavigator.
 */

import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateTo(name: keyof RootStackParamList) {
  if (navigationRef.isReady()) {
    // @ts-ignore — generic navigate accepts any valid screen name
    navigationRef.navigate(name);
  }
}
