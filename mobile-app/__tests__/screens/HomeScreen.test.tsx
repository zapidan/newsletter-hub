import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { HomeScreen } from '../../src/screens/HomeScreen';

describe('HomeScreen', () => {
  it('renders correctly', () => {
    render(<HomeScreen />);

    expect(screen.getByText('Welcome to NewsletterHub')).toBeTruthy();
    expect(screen.getByText('Your newsletters will appear here')).toBeTruthy();
  });

  it('has proper styling for mobile layout', () => {
    render(<HomeScreen />);

    const container = screen.getByTestId('home-container');
    const text = screen.getByText('Welcome to NewsletterHub');
    const subtext = screen.getByText('Your newsletters will appear here');

    // Check container styling
    expect(container.props.style).toMatchObject({
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    });

    // Check text styling
    expect(text.props.style).toMatchObject({
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 10,
    });

    // Check subtext styling
    expect(subtext.props.style).toMatchObject({
      fontSize: 16,
      color: '#666',
    });
  });

  it('is accessible', () => {
    render(<HomeScreen />);

    // Check that text is accessible
    expect(screen.getByText('Welcome to NewsletterHub')).toBeTruthy();
    expect(screen.getByText('Your newsletters will appear here')).toBeTruthy();
  });
}); 