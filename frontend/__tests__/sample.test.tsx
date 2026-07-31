import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui/Button';
import { AuthContext } from '@/context/AuthContext';
import { getCurrentUser } from '@/services/auth';

describe('Alias Resolution & Component Tests', () => {
  it('renders children correctly and resolves @/components alias', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('resolves nested path aliases @/context/AuthContext and @/services/auth', () => {
    expect(AuthContext).toBeDefined();
    expect(typeof getCurrentUser).toBe('function');
  });
});
