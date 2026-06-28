/**
 * Tests for the Sidebar component (Reduce the Surface: grouped navigation).
 *
 * Proves the information-architecture regrouping does NOT remove any
 * functionality: all seven destinations stay reachable. Dashboard, Tasks,
 * Calendar and Settings render by default; Planner, Habits and Analytics are
 * tucked under the collapsible "More" disclosure and become visible once it is
 * toggled open. A separate render confirms the secondary group auto-expands on
 * mount when the active route already lives inside it.
 *
 * next/navigation usePathname is mocked via a mutable `mockPathname` so each
 * test can choose the active route. useTheme is mocked so the component renders
 * without a ThemeProvider wrapper.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/ui/theme-provider", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: jest.fn() }),
}));

import Sidebar from "@/components/layout/Sidebar";

const linkByName = (name: string) =>
  screen.queryByRole("link", { name: new RegExp(name, "i") });

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockPathname = "/dashboard";
  });

  it("renders the primary destinations and Settings by default", () => {
    render(<Sidebar />);

    // Primary group is always visible.
    expect(linkByName("Dashboard")).not.toBeNull();
    expect(linkByName("Tasks")).not.toBeNull();
    expect(linkByName("Calendar")).not.toBeNull();

    // Settings is pinned at the bottom and always reachable.
    expect(linkByName("Settings")).not.toBeNull();

    // Secondary group is collapsed by default for new users.
    expect(linkByName("Planner")).toBeNull();
    expect(linkByName("Habits")).toBeNull();
    expect(linkByName("Analytics")).toBeNull();
  });

  it("exposes the secondary destinations after toggling 'More' (no functionality removed)", () => {
    render(<Sidebar />);

    const moreToggle = screen.getByRole("button", {
      name: /more navigation/i,
    });

    act(() => {
      fireEvent.click(moreToggle);
    });

    // All three secondary destinations are now reachable.
    expect(linkByName("Planner")).not.toBeNull();
    expect(linkByName("Habits")).not.toBeNull();
    expect(linkByName("Analytics")).not.toBeNull();

    // And the primary destinations + Settings are still present, so every one
    // of the seven destinations is reachable.
    expect(linkByName("Dashboard")).not.toBeNull();
    expect(linkByName("Tasks")).not.toBeNull();
    expect(linkByName("Calendar")).not.toBeNull();
    expect(linkByName("Settings")).not.toBeNull();
  });

  it("auto-expands the secondary group when the active route lives in it", () => {
    mockPathname = "/dashboard/analytics";

    render(<Sidebar />);

    // Analytics is visible without clicking "More" because the active route is
    // a secondary one.
    expect(linkByName("Analytics")).not.toBeNull();
    expect(linkByName("Habits")).not.toBeNull();
    expect(linkByName("Planner")).not.toBeNull();
  });
});
