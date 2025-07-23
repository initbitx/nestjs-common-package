# Initbit - NestJS Common Packages

A collection of common NestJS packages developed by Initbit Technologies for building scalable microservices.

## Overview

This monorepo contains a collection of NestJS packages that provide common functionality for building microservices. The packages are designed to be modular, reusable, and easy to integrate into any NestJS application.

## Available Packages

### NATS JetStream Transport

A NestJS microservice transport for NATS JetStream, providing seamless integration between NestJS microservices and NATS JetStream, a persistent streaming system built on top of NATS.

**Features:**
- Connect to NATS JetStream
- Create and manage streams and consumers
- Handle JetStream messages with acknowledgments
- Support for request-response patterns
- Support for event-based patterns
- Queue group support
- Configurable consumer options

[Learn more about NATS JetStream Transport](./packages/nats-jetstream/README.md)

## Installation

This is a monorepo managed with Lerna. To get started, clone the repository and install dependencies:

```bash
  # Clone the repository
  git clone <repository-url>
  cd nest-common-packages
  
  # Install dependencies
  npm install
  
  # Bootstrap the monorepo
  npm run bootstrap
```

## Development

### Scripts

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

## Requirements and Roadmap

For detailed information about the requirements and future plans for each package, please refer to the documentation in the `docs` directory:

- [Requirements](./docs/requirements.md)
- [Improvement Plan](./docs/plan.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](./LICENSE).

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for more information on how to get involved.

## Contact

For any questions or concerns, please contact Initbit Technologies at connect@inibit.com.
