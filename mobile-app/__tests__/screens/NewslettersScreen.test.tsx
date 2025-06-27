import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NewslettersScreen } from '../../src/screens/NewslettersScreen';

describe('NewslettersScreen', () => {
  it('renders correctly', () => {
    const tree = ReactTestRenderer.create(<NewslettersScreen />);
    expect(tree).toMatchSnapshot();
  });

  it('shows empty state when no newsletters', () => {
    const tree = ReactTestRenderer.create(<NewslettersScreen />);
    const instance = tree.root;

    expect(instance.findByProps({ children: 'No newsletters yet' })).toBeTruthy();
    expect(instance.findByProps({ children: 'Your newsletters will appear here' })).toBeTruthy();
  });

  it('has proper mobile styling', () => {
    const tree = ReactTestRenderer.create(<NewslettersScreen />);
    const instance = tree.root;

    const container = instance.findByProps({ testID: 'newsletters-container' });
    const emptyState = instance.findByProps({ testID: 'empty-state' });

    // Check container styling
    expect(container.props.style).toMatchObject({
      flex: 1,
      padding: 16,
    });

    // Check empty state styling
    expect(emptyState.props.style).toMatchObject({
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    });
  });
}); 