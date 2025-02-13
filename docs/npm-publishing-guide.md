# Guide to Publishing @initbit/nestjs-jetstream to npm

This guide provides step-by-step instructions for publishing the `@initbit/nestjs-jetstream` package to npm.

## Prerequisites

Before publishing, ensure you have:

1. Node.js (v18 or higher) installed
2. npm account with access to the `@initbit` organization
3. Git access to the repository
4. All changes committed to the repository

## Authentication with npm

Before publishing, you need to authenticate with npm:

```bash
# Login to npm
npm login

# If publishing to an organization scope (@initbit)
# Ensure you have the right access permissions
npm access list packages
```

## Publishing Process

This project uses a combination of NX and Lerna for managing the monorepo and publishing packages. Follow these steps to publish the package:

### 1. Build the Package

First, build the package using NX:

```bash
  # Navigate to the repository root
  cd /path/to/nest-common-packages
  
  # Build the specific package
  npx nx build @initbit/nestjs-jetstream
```

This will compile the TypeScript code and prepare the package for publishing in the `dist/packages/nats-jetstream` directory.

### 2. Version the Package

Use Lerna to version the package:

```bash
  # At the repository root
  npm run version
```

This will:
- Prompt you to select a new version (patch, minor, major)
- Update the version in package.json
- Create a git commit with the version change
- Create a git tag for the version

Alternatively, you can specify the version directly:

```bash
  npx lerna version [major | minor | patch | specific-version]
```

### 3. Publish the Package

There are two ways to publish the package:

#### Option 1: Using Lerna (Recommended)

```bash
  # At the repository root
  npm run publish
```

This will use Lerna to publish all packages that have changed since the last release.

#### Option 2: Using NX

```bash
  # At the repository root
  npx nx nx-release-publish @initbit/nestjs-jetstream
```

This will run the `nx-release-publish` target defined in the project.json file, which executes `npm publish` in the dist directory.

## Verifying the Publication

After publishing, verify that the package is available on npm:

```bash
# Check if the package is published
npm view @initbit/nestjs-jetstream

# Check the available versions
npm view @initbit/nestjs-jetstream versions
```

## Publishing to a Local Registry (for Testing)

For testing the publishing process without affecting the public npm registry, you can use Verdaccio, which is already included as a dev dependency:

```bash
  # Start Verdaccio
  npx verdaccio
  
  # In a new terminal, login to the local registry
  npm login --registry http://localhost:4873
  
  # Publish to the local registry
  npm publish --registry http://localhost:4873
```

## Troubleshooting

### Common Issues

1. **Authentication errors**: Ensure you're logged in to npm and have the right permissions for the @initbit organization.

2. **Version conflicts**: If the version already exists on npm, you'll need to update the version in package.json.

3. **Build errors**: Make sure the build completes successfully before attempting to publish.

4. **Files missing in published package**: Check the "files" field in package.json to ensure all necessary files are included.

### Handling Failed Publications

If the publication fails:

1. Check the error message for specific issues
2. Fix any identified problems
3. If needed, unpublish a recently published version (within 72 hours):
   ```bash
   npm unpublish @initbit/nestjs-jetstream@x.y.z
   ```
4. Try publishing again

## Best Practices

1. **Always build before publishing**: Ensure the package is built and tested before publishing.

2. **Use semantic versioning**: Follow semantic versioning (major.minor.patch) when versioning the package.

3. **Update the README**: Make sure the README is up-to-date before publishing.

4. **Test the package**: Run tests to ensure the package works as expected.

5. **Consider using release candidates**: For major changes, consider publishing a release candidate first (e.g., 1.0.0-rc.1).
