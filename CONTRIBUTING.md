# Contributing to Initbit - NestJS Common Packages

Thank you for your interest in contributing to Initbit's NestJS Common Packages! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct, which promotes a respectful and inclusive environment for everyone.

## How to Contribute

There are several ways you can contribute to this project:

1. **Reporting Bugs**: If you find a bug, please create an issue with a detailed description.
2. **Suggesting Enhancements**: Have ideas for new features or improvements? Submit an enhancement proposal as an issue.
3. **Pull Requests**: Submit pull requests with bug fixes or new features.
4. **Documentation**: Help improve or translate documentation.
5. **Answering Questions**: Help answer questions in issues or discussions.

## Development Setup

This is a monorepo managed with Lerna. To set up the development environment:

```bash
# Clone the repository
git clone <repository-url>
cd nest-common-packages

# Install dependencies
npm install

# Bootstrap the monorepo
npm run bootstrap
```

### Available Scripts

The following scripts are available for managing the monorepo:

- `npm run bootstrap`: Bootstrap the packages in the current Lerna repo
- `npm run clean`: Remove the node_modules directory from all packages
- `npm run init`: Initialize a Lerna repo
- `npm run publish`: Publish packages in the current project
- `npm run run`: Run an npm script in each package
- `npm run version`: Bump version of packages changed since the last release

### Building Packages

To build a specific package:

```bash
nx build <package-name>
```

For example:

```bash
nx build nats-jetstream
```

### Running Tests

To run tests for a specific package:

```bash
nx test <package-name>
```

For example:

```bash
nx test nats-jetstream
```

## Coding Standards

Please follow these coding standards when contributing:

1. **TypeScript**: Use TypeScript for all code.
2. **Formatting**: Follow the project's formatting rules (enforced by ESLint and Prettier).
3. **Documentation**: Document all public APIs, classes, methods, and interfaces with JSDoc comments.
4. **Testing**: Write tests for all new features and bug fixes.
5. **Commit Messages**: Write clear, concise commit messages that explain the changes made.

## Pull Request Process

1. **Fork the Repository**: Create your own fork of the repository.
2. **Create a Branch**: Create a branch for your changes.
3. **Make Changes**: Make your changes following the coding standards.
4. **Write Tests**: Add tests for your changes.
5. **Update Documentation**: Update documentation to reflect your changes.
6. **Submit Pull Request**: Submit a pull request with a clear description of the changes.
7. **Code Review**: Address any feedback from code reviews.
8. **Merge**: Once approved, your pull request will be merged.

## Issue Reporting Guidelines

When reporting issues, please include:

1. **Description**: A clear description of the issue.
2. **Steps to Reproduce**: Detailed steps to reproduce the issue.
3. **Expected Behavior**: What you expected to happen.
4. **Actual Behavior**: What actually happened.
5. **Environment**: Information about your environment (OS, Node.js version, etc.).
6. **Additional Information**: Any other relevant information.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's license, which is private and proprietary to Initbit Technologies.

## Contact

For any questions or concerns about contributing, please contact Initbit Technologies at connect@inibit.com.

Thank you for contributing to Initbit - NestJS Common Packages!
