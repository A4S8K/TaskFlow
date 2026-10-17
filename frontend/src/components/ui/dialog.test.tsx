import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "../../i18n";
import { Button } from "./button";
import { Dialog } from "./dialog";

function ExampleDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open task</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Task details"
        description="Edit this task"
      >
        <label htmlFor="task-title">Title</label>
        <input id="task-title" />
        <Button onClick={() => setOpen(false)}>Save</Button>
      </Dialog>
    </>
  );
}

describe("Dialog keyboard behavior", () => {
  it("exposes its title, keeps keyboard focus inside, and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);
    await user.click(screen.getByRole("button", { name: "Open task" }));
    const dialog = screen.getByRole("dialog", { name: "Task details" });
    expect(dialog).toHaveAccessibleDescription("Edit this task");
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
    for (let index = 0; index < 5; index += 1) await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(document.activeElement ?? document, {
      key: "Escape",
      code: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("composes a single navigation child with asChild", () => {
    render(
      <Button asChild variant="outline">
        <a href="/projects">View projects</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "View projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });
});
