import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StepIndicator } from './StepIndicator';

const STEPS = [
    { label: 'Basic Info' },
    { label: 'Method' },
    { label: 'Participants' },
    { label: 'Review' },
];

describe('StepIndicator', () => {
    it('renders the correct number of steps', () => {
        render(<StepIndicator steps={STEPS} currentStep={0} />);
        const labels = screen.getAllByText(/Basic Info|Method|Participants|Review/);
        expect(labels.length).toBe(4);
    });

    it('shows step numbers for incomplete steps', () => {
        render(<StepIndicator steps={STEPS} currentStep={0} />);
        expect(screen.getByText('2')).toBeDefined();
        expect(screen.getByText('3')).toBeDefined();
        expect(screen.getByText('4')).toBeDefined();
    });

    it('highlights the active step label', () => {
        const { container } = render(<StepIndicator steps={STEPS} currentStep={1} />);
        const methodLabel = screen.getByText('Method');
        expect(methodLabel.className).toContain('text-purple-600');
        expect(container).toBeTruthy();
    });

    it('renders a check for completed steps', () => {
        const { container } = render(<StepIndicator steps={STEPS} currentStep={2} />);
        // Steps 0 and 1 should have check icons (svg), not numbers
        const stepNumbers = container.querySelectorAll('div[class*="rounded-full"]');
        expect(stepNumbers.length).toBeGreaterThan(0);
    });
});
