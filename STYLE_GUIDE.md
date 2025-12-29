# TripApp UI Style Guide

**Version:** 1.0
**Reference Pages:** Kit List (`/kit`), Create Trip Form
**Last Updated:** December 2024

This document defines the canonical UI styling patterns for TripApp. All new screens must follow these guidelines, and existing pages should be reviewed against this standard.

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Typography](#2-typography)
3. [Color System](#3-color-system)
4. [Spacing](#4-spacing)
5. [Layout Patterns](#5-layout-patterns)
6. [Components](#6-components)
7. [Forms](#7-forms)
8. [Lists](#8-lists)
9. [Modals & Overlays](#9-modals--overlays)
10. [States & Feedback](#10-states--feedback)
11. [Accessibility](#11-accessibility)
12. [Dark Mode](#12-dark-mode)
13. [Responsive Design](#13-responsive-design)

---

## 1. Design Tokens

All styling values are defined in `styles/tokens.css`. **Never use hardcoded values** - always reference tokens or their Tailwind equivalents.

### Token File Location
```
/styles/tokens.css
```

### Why Tokens Matter
- Single source of truth for all design values
- Easy global updates
- Consistency across components
- Supports theming

---

## 2. Typography

### Font Family
- **Primary:** System sans-serif (Arial, Helvetica, sans-serif)
- **Monospace:** Geist Mono (for code/data)

### Font Sizes
| Token | Size | Tailwind | Use Case |
|-------|------|----------|----------|
| `--font-size-xs` | 12px | `text-xs` | Captions, badges |
| `--font-size-sm` | 14px | `text-sm` | Secondary text, labels, help text |
| `--font-size-base` | 16px | `text-base` | Body text, inputs, buttons |
| `--font-size-lg` | 18px | `text-lg` | Compact titles |
| `--font-size-xl` | 20px | `text-xl` | Modal titles |
| `--font-size-2xl` | 24px | `text-2xl` | Page titles |

### Font Weights
| Token | Weight | Tailwind | Use Case |
|-------|--------|----------|----------|
| `--font-weight-normal` | 400 | `font-normal` | Body text |
| `--font-weight-medium` | 500 | `font-medium` | Labels, tabs, secondary emphasis |
| `--font-weight-semibold` | 600 | `font-semibold` | List row primary text, compact titles |
| `--font-weight-bold` | 700 | `font-bold` | Page titles, headings |

### Line Heights
| Token | Value | Tailwind |
|-------|-------|----------|
| `--line-height-tight` | 1.25 | `leading-tight` |
| `--line-height-normal` | 1.5 | `leading-normal` |

### Heading Hierarchy
```jsx
// Page title (full)
<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">

// Page title (compact/collapsed)
<h1 className="text-lg font-semibold text-zinc-900 dark:text-white">

// Modal title
<h2 className="text-xl font-semibold text-zinc-900 dark:text-white">

// Section label
<label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
```

---

## 3. Color System

### Primary Palette (Blue)
| Token | Hex | Tailwind | Use Case |
|-------|-----|----------|----------|
| `--color-primary` | #2563eb | `blue-600` | Primary buttons, focus rings, selected states |
| `--color-primary-hover` | #1d4ed8 | `blue-700` | Button hover |
| `--color-primary-light` | #dbeafe | `blue-100` | Badges, highlights |

### Neutral Palette (Zinc)
| Token | Light Mode | Dark Mode | Use Case |
|-------|------------|-----------|----------|
| `--color-neutral-50` | Background | Text | Page backgrounds (light) |
| `--color-neutral-100` | Subtle backgrounds | - | Segmented control bg |
| `--color-neutral-200` | Borders, dividers | - | Light borders |
| `--color-neutral-300` | Input borders | - | Form borders |
| `--color-neutral-400` | Placeholder, muted | Trailing numbers | Secondary text |
| `--color-neutral-500` | Help text | Help text | Tertiary text |
| `--color-neutral-600` | Secondary text | Tab text | Body text variants |
| `--color-neutral-700` | Primary text, labels | Borders | Dark mode borders |
| `--color-neutral-800` | - | Surface bg | Cards, inputs (dark) |
| `--color-neutral-900` | Primary text | Background | Page bg (dark) |
| `--color-neutral-950` | - | Deep background | Darkest surfaces |

### Semantic Colors
| Token | Hex | Tailwind | Use Case |
|-------|-----|----------|----------|
| `--color-success` | #22c55e | `green-500` | Success states |
| `--color-warning` | #f59e0b | `amber-500` | Warning states |
| `--color-error` | #ef4444 | `red-500` | Error states, destructive |
| `--color-info` | #3b82f6 | `blue-500` | Informational |

---

## 4. Spacing

### Spacing Scale
| Token | Size | Tailwind | Use Case |
|-------|------|----------|----------|
| `--space-xs` | 4px | `p-1`, `gap-1` | Tight spacing |
| `--space-sm` | 8px | `p-2`, `gap-2` | Small gaps |
| `--space-md` | 16px | `p-4`, `gap-4` | Standard spacing |
| `--space-lg` | 24px | `p-6`, `gap-6` | Section spacing |
| `--space-xl` | 32px | `p-8` | Large sections |
| `--space-2xl` | 48px | `py-12` | Page sections |

### Common Spacing Patterns
```jsx
// Form sections
<form className="space-y-6">

// Button groups
<div className="flex gap-3">

// List item padding
<div className="px-4 py-3">

// Container padding
<div className="px-4">

// Segmented control container
<div className="mx-4 my-2">
```

---

## 5. Layout Patterns

### Page Structure

All list pages use `TopEndListPage` layout:

```jsx
import { TopEndListPage } from "@/components/layout/TopEndListPage";

<TopEndListPage
  title="Page Title"
  titleRight={/* Optional right content */}
  stickyContent={/* Tabs, search, filters */}
  fab={<FloatingActionButton ... />}
>
  {/* Scrollable content */}
</TopEndListPage>
```

### TopEndListPage Structure
```
+----------------------------------+
|  Title                   [Right] |  <- Collapsible on scroll
+----------------------------------+
|  [Tab 1] [Tab 2] [Tab 3]        |  <- Sticky
|  [Search input         ] [Btn]   |  <- Sticky
+----------------------------------+
|                                  |
|  Scrollable List Content         |
|                                  |
|                                  |
+----------------------------------+
                              [FAB]   <- Fixed bottom-right
```

### Container Heights
```css
/* Full viewport minus header */
height: calc(100dvh - 7rem);

/* Modal max height */
max-height: 90vh;
```

### Z-Index Scale
| Token | Value | Use Case |
|-------|-------|----------|
| `--z-base` | 0 | Default |
| `--z-dropdown` | 1000 | Dropdowns |
| `--z-sticky` | 1020 | Sticky headers |
| `--z-fixed` | 1030 | Fixed elements |
| `--z-modal-backdrop` | 1040 | Modal backdrop |
| `--z-modal` | 1050 | Modal content |
| `--z-tooltip` | 1070 | Tooltips |

---

## 6. Components

### Buttons

Import: `import { Button } from "@/components/ui/button"`

#### Variants
| Variant | Use Case | Appearance |
|---------|----------|------------|
| `primary` | Main actions | Blue background, white text |
| `secondary` | Secondary actions | Gray background |
| `outline` | Tertiary actions | Transparent with border |
| `ghost` | Subtle actions | Transparent, text only |
| `destructive` | Delete/remove | Red background |

#### Sizes
| Size | Height | Use Case |
|------|--------|----------|
| `sm` | 32px (h-8) | Compact contexts |
| `md` | 40px (h-10) | Default |
| `lg` | 48px (h-12) | Prominent actions |

#### Usage
```jsx
<Button variant="primary" size="md" loading={isLoading}>
  Create Trip
</Button>

<Button variant="secondary" className="flex-1">
  Cancel
</Button>

<Button variant="destructive">
  Delete
</Button>
```

### Floating Action Button (FAB)

Import: `import { FloatingActionButton } from "@/components/ui/FloatingActionButton"`

```jsx
<FloatingActionButton
  onClick={handleCreate}
  aria-label="Create new item"
  variant="primary" // or "secondary"
/>
```

**Specifications:**
- Size: 56px (w-14 h-14)
- Position: Fixed, bottom-right with safe area awareness
- Default icon: Plus sign
- Shadow: `shadow-lg`

### Segmented Control

Import: `import { SegmentedControl } from "@/components/ui/SegmentedControl"`

```jsx
<SegmentedControl
  options={[
    { value: "my-items", label: "My Items", count: 12 },
    { value: "public", label: "Public", count: 45 },
  ]}
  value={activeTab}
  onChange={setActiveTab}
  aria-label="View options"
/>
```

**Specifications:**
- Container: `bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 mx-4 my-2`
- Selected tab: `bg-white dark:bg-zinc-700 shadow-sm`
- Min height: 36px

---

## 7. Forms

### Field Wrapper

Import: `import { Field, Input, Select, Textarea } from "@/components/ui/field"`

```jsx
<Field label="Trip Name" htmlFor="name" required error={errors.name}>
  <Input
    id="name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="e.g., Summer Vacation 2025"
  />
</Field>
```

### Input Specifications
| Property | Value |
|----------|-------|
| Height | 40px (h-10) + padding = 44px tap target |
| Border radius | 8px (rounded-lg) |
| Border | `border-zinc-300 dark:border-zinc-700` |
| Focus | `ring-2 ring-blue-500 border-transparent` |
| Background | `bg-white dark:bg-zinc-800` |

### Form Layout
```jsx
<form className="space-y-6">
  {/* Error banner at top */}
  {error && <ErrorBanner message={error} />}

  {/* Form fields */}
  <Field label="Name" ...>

  {/* Two-column layout for dates */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <Field label="Start Date" ...>
    <Field label="End Date" ...>
  </div>

  {/* Action buttons */}
  <div className="flex gap-3 pt-2">
    <Button variant="secondary" className="flex-1">Cancel</Button>
    <Button variant="primary" className="flex-1">Submit</Button>
  </div>
</form>
```

### Template/Card Selection
For horizontal scrolling selection carousels:
```jsx
<div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
  <button
    className={`flex-shrink-0 w-[200px] snap-center ${
      isSelected ? "ring-2 ring-blue-500" : ""
    }`}
  >
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-4
                    border-2 border-zinc-200 dark:border-zinc-700
                    min-h-[120px]">
      {/* Card content */}
    </div>
  </button>
</div>
```

---

## 8. Lists

### ListRow Component

Import: `import { ListRow } from "@/components/ui/ListRow"`

```jsx
<ListRow
  primary="Item Title"
  secondary="Optional subtitle"
  trailing={12}        // Number count
  // or trailing={true}  // Chevron
  onClick={() => {}}
  onLongPress={(e) => {}}
  isLast={index === items.length - 1}
/>
```

**Specifications:**
| Property | Value |
|----------|-------|
| Min height | 56px |
| Padding | `px-4 py-3` |
| Background | `bg-white dark:bg-zinc-900` |
| Divider | `border-b border-zinc-100 dark:border-zinc-800` (except last) |
| Active state | `active:bg-zinc-50 dark:active:bg-zinc-800` |

### List Container
```jsx
<div className="bg-white dark:bg-zinc-900">
  {items.map((item, index) => (
    <ListRow
      key={item.id}
      isLast={index === items.length - 1}
      ...
    />
  ))}
</div>
```

### Empty State
```jsx
<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
  <p className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
    No items yet
  </p>
  <p className="text-sm text-zinc-500 dark:text-zinc-400">
    Helpful description of what to do
  </p>
</div>
```

---

## 9. Modals & Overlays

### Modal Component

Import: `import { Modal } from "@/components/ui/modal"`

```jsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md"
  footer={
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onConfirm}>Confirm</Button>
    </>
  }
>
  {/* Modal content */}
</Modal>
```

**Sizes:**
| Size | Max Width |
|------|-----------|
| `sm` | 448px (max-w-md) |
| `md` | 512px (max-w-lg) |
| `lg` | 672px (max-w-2xl) |
| `xl` | 896px (max-w-4xl) |
| `full` | calc(100vw - 2rem) |

**Structure:**
- Backdrop: `bg-black/50 backdrop-blur-sm`
- Container: `bg-white dark:bg-zinc-800 rounded-lg shadow-xl`
- Header: `p-6 border-b`
- Content: `p-6 overflow-y-auto`
- Footer: `p-6 border-t bg-zinc-50 dark:bg-zinc-900/50`

### Toast Notifications
```jsx
{toast && (
  <div className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg ${
    toast.type === "success"
      ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800"
      : "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800"
  }`}>
    <p className={toast.type === "success"
      ? "text-green-800 dark:text-green-200"
      : "text-red-800 dark:text-red-200"
    }>
      {toast.message}
    </p>
  </div>
)}
```

---

## 10. States & Feedback

### Loading States

**Full page loader:**
```jsx
<div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto" />
    <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
  </div>
</div>
```

**Inline loader:**
```jsx
<div className="flex justify-center py-12">
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600" />
</div>
```

**Button loading:**
```jsx
<Button loading={isLoading}>Submit</Button>
```

### Error States

**Error banner:**
```jsx
<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
  {errorMessage}
</div>
```

**Field error:**
```jsx
<p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-500">
  {error}
</p>
```

### Disabled States
- Opacity: `opacity-60`
- Cursor: `cursor-not-allowed`

---

## 11. Accessibility

### Minimum Tap Targets
**WCAG AAA compliance: 44px minimum**

```jsx
// Utility class
className="tap-target" // Sets min-height: 44px

// Or explicit
className="min-h-[44px]"
```

### Focus States
```jsx
className="focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-blue-600 dark:focus-visible:ring-blue-500
           focus-visible:ring-offset-2
           focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
```

### ARIA Attributes
```jsx
// Tabs
<div role="tablist" aria-label="View options">
  <button role="tab" aria-selected={isActive} aria-controls="panel-id">

// Alerts
<p role="alert">{errorMessage}</p>

// Loading states
<button aria-busy={isLoading}>

// Required fields
<span aria-hidden="true" className="text-red-600">*</span>
```

### Keyboard Navigation
- All interactive elements must be focusable
- Support Enter/Space for button-like elements
- Support Escape to close modals
- Maintain logical tab order

---

## 12. Dark Mode

### Implementation
Dark mode is automatic via `prefers-color-scheme: dark` media query.

### Pattern
Always pair light and dark classes:
```jsx
className="bg-white dark:bg-zinc-800"
className="text-zinc-900 dark:text-white"
className="border-zinc-200 dark:border-zinc-700"
```

### Key Mappings
| Element | Light | Dark |
|---------|-------|------|
| Page background | `bg-zinc-50` | `dark:bg-zinc-900` |
| Card/Surface | `bg-white` | `dark:bg-zinc-800` |
| Primary text | `text-zinc-900` | `dark:text-white` |
| Secondary text | `text-zinc-600` | `dark:text-zinc-400` |
| Muted text | `text-zinc-500` | `dark:text-zinc-400` |
| Borders | `border-zinc-200` | `dark:border-zinc-700` |
| Dividers | `border-zinc-100` | `dark:border-zinc-800` |

---

## 13. Responsive Design

### Breakpoints
| Name | Width | Use Case |
|------|-------|----------|
| `sm` | 390px | Mobile baseline |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |

### Mobile-First Approach
Always start with mobile styles, then add larger breakpoints:
```jsx
// Single column on mobile, two columns on desktop
className="grid grid-cols-1 sm:grid-cols-2 gap-4"

// Progressive padding
className="px-3 sm:px-4 md:px-6"
```

### Safe Area Support
For mobile notches and home indicators:
```jsx
style={{
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  bottom: "calc(72px + env(safe-area-inset-bottom, 0px))"
}}
```

### Prevent Horizontal Overflow
Applied globally in `globals.css`:
```css
html, body {
  max-width: 100%;
  overflow-x: hidden;
}
```

Use `.minw0` utility on flex/grid children:
```jsx
<div className="flex-1 min-w-0"> // or className="flex-1 minw0"
```

---

## 14. Button Labels

### Standard Action Labels
Use consistent, generic labels for all action buttons:

| Action | Label | NOT |
|--------|-------|-----|
| Start creation | **+ Add** | "Add Task", "Create Checklist", "New Item" |
| Complete/save | **Save** | "Save Trip", "Create", "Submit" |
| Dismiss | **Cancel** | "Close", "Dismiss" |
| Remove | **Delete** | "Remove Item", "Delete Trip" |

### Why Generic Labels?
- Consistent muscle memory across the app
- Cleaner, less cluttered UI
- Context is already clear from the screen/modal title
- Shorter labels fit better on mobile

### Examples
```jsx
// Good
<FloatingActionButton aria-label="Add" />
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>

// Bad
<FloatingActionButton aria-label="Create new checklist" />
<Button variant="primary">Save Trip</Button>
<Button variant="secondary">Cancel Creation</Button>
```

### FAB Labels
The FAB should use `aria-label="Add"` for accessibility, but displays only the `+` icon visually.

---

## Quick Reference Checklist

When building a new page, verify:

- [ ] Uses `TopEndListPage` layout (for list pages)
- [ ] Page title is `text-2xl font-bold`
- [ ] Forms use `Field`, `Input`, `Select`, `Textarea` components
- [ ] Forms have `space-y-6` spacing
- [ ] Buttons use `Button` component with proper variants
- [ ] Lists use `ListRow` component
- [ ] All tap targets are minimum 44px
- [ ] Focus states are visible
- [ ] Dark mode classes are paired
- [ ] Loading states show spinner
- [ ] Error states use red color scheme
- [ ] Empty states are centered with helpful text
- [ ] Toast notifications are positioned top-right
- [ ] FAB is positioned bottom-right with safe area
- [ ] All colors use design tokens (no hardcoded hex)
- [ ] All spacing uses Tailwind scale (no arbitrary values unless necessary)

---

## File Reference

| File | Purpose |
|------|---------|
| `styles/tokens.css` | Design tokens (colors, spacing, typography) |
| `app/globals.css` | Global styles, utilities |
| `components/ui/button.tsx` | Button component |
| `components/ui/field.tsx` | Form field components |
| `components/ui/ListRow.tsx` | List row component |
| `components/ui/SegmentedControl.tsx` | Tab control |
| `components/ui/FloatingActionButton.tsx` | FAB component |
| `components/ui/modal.tsx` | Modal component |
| `components/layout/TopEndListPage.tsx` | List page layout |
