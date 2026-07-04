import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Card,
  CardContent,
  CardDescription,
  CardEbHead,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card-eb';

describe('Card (extended)', () => {
  it('renders children with default variant', () => {
    render(
      <Card data-testid="c">
        <p>body</p>
      </Card>,
    );
    expect(screen.getByTestId('c')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it.each(['tight', 'flush'] as const)('reflects %s variant', (variant) => {
    render(
      <Card data-testid="c" variant={variant}>
        x
      </Card>,
    );
    expect(screen.getByTestId('c')).toHaveAttribute('data-variant', variant);
  });

  it('composes shadcn subcomponents under the extended Card', () => {
    render(
      <Card variant="flush">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Sub</CardDescription>
        </CardHeader>
        <CardContent>body</CardContent>
        <CardFooter>foot</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('foot')).toBeInTheDocument();
  });

  it('CardEbHead renders title and optional meta slot', () => {
    render(
      <Card variant="flush">
        <CardEbHead meta="12 items">Recent applications</CardEbHead>
        <CardContent>list</CardContent>
      </Card>,
    );
    expect(screen.getByText('Recent applications')).toBeInTheDocument();
    expect(screen.getByText('12 items')).toBeInTheDocument();
  });
});
