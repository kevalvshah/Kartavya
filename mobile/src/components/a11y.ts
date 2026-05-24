/**
 * a11y.ts — Accessibility prop factories
 * ───────────────────────────────────────
 * Helpers that return the correct RN accessibility props.
 * Import and spread onto Touchable* / Pressable components.
 *
 * Usage:
 *   <TouchableOpacity {...a11yButton('Mark task done')} onPress={...}>
 *   <View {...a11yHeading('Today')}>
 *   <TextInput {...a11yInput('Task title', 'Enter the task title')} />
 */

import type { AccessibilityRole } from 'react-native';

/** Interactive button / pressable element */
export function a11yButton(label: string, hint?: string) {
  return {
    accessible:           true as const,
    accessibilityRole:    'button' as AccessibilityRole,
    accessibilityLabel:   label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

/** Link that navigates somewhere */
export function a11yLink(label: string, hint?: string) {
  return {
    accessible:           true as const,
    accessibilityRole:    'link' as AccessibilityRole,
    accessibilityLabel:   label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

/** Screen section heading */
export function a11yHeading(label: string) {
  return {
    accessible:           true as const,
    accessibilityRole:    'header' as AccessibilityRole,
    accessibilityLabel:   label,
  };
}

/** Text input / form field */
export function a11yInput(label: string, hint?: string) {
  return {
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : {}),
    accessible: true as const,
  };
}

/** Toggle / checkbox */
export function a11yToggle(label: string, checked: boolean, hint?: string) {
  return {
    accessible:             true as const,
    accessibilityRole:      'checkbox' as AccessibilityRole,
    accessibilityLabel:     label,
    accessibilityState:     { checked },
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

/** Image with description */
export function a11yImage(label: string) {
  return {
    accessible:           true as const,
    accessibilityRole:    'image' as AccessibilityRole,
    accessibilityLabel:   label,
  };
}

/** Pure display element that should be announced */
export function a11yText(label: string) {
  return {
    accessible:        true as const,
    accessibilityLabel: label,
  };
}

/** Mark as a selected item in a list (e.g. active tab) */
export function a11ySelected(label: string, selected: boolean) {
  return {
    accessible:          true as const,
    accessibilityLabel:  label,
    accessibilityState:  { selected },
  };
}
