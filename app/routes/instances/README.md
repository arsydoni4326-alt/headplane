# Multi-Instance Dashboard

This feature allows you to manage multiple Headscale instances from a single Headplane dashboard.

## Features

- **Multiple Instance Management**: Add, edit, and delete Headscale instance configurations
- **Secure Credential Storage**: API keys and OIDC secrets are encrypted at rest using AES-256-GCM
- **Instance Switcher**: Switch between instances without logging out
- **Default Instance**: Mark one instance as the default for quick access

## Architecture

### Frontend (`headplane/app/`)

- **Types**: `types/Instance.ts` - TypeScript interfaces for instance configuration
- **Routes**:
  - `routes/instances/overview.tsx` - List and manage instances
  - `routes/instances/new.tsx` - Add new instance
- **Navigation**: Instance link added to header navigation

### Backend (`headplane/app/server/`)

- **Service**: `instances.ts` - Instance CRUD operations with encryption
- **Database**: `db/schema.ts` - SQLite schema for instances table
- **Migration**: `drizzle/20260930041900_add_instances_table/` - Database migration

### Security

All sensitive data (API keys, OIDC secrets) is encrypted using:

- **Algorithm**: AES-256-GCM
- **Key Derivation**: scrypt with random salt
- **Format**: `salt:iv:authTag:encryptedData` (base64-encoded)

Credentials are **never** sent to the browser after initial save.

## Usage

### Setup

1. Set the encryption secret (required):

   ```bash
   export INSTANCE_ENCRYPTION_SECRET="your-secure-random-secret-here"
   ```

2. Start Headplane:

   ```bash
   cd headplane
   pnpm install
   pnpm dev
   ```

3. Navigate to `/instances` in the UI

### Adding an Instance

1. Click "Add Instance"
2. Fill in the form:
   - **Name**: Friendly display name (e.g., "Production")
   - **API URL**: Base URL of the Headscale instance
   - **API Key**: (Optional) Authentication credential
   - **OIDC Client ID/Secret**: (Optional) OAuth credentials
   - **Set as default**: Mark as the default instance
3. Click "Save Instance"

### Switching Instances

Use the instance switcher in the navigation bar to switch between configured instances.

## API Endpoints

The instance service provides the following methods:

- `list()` - List all instances (no secrets)
- `get(id)` - Get a single instance (no secrets)
- `create(data)` - Create a new instance
- `update(id, data)` - Update an existing instance
- `remove(id)` - Delete an instance
- `getCredentials(id)` - Get decrypted credentials (internal use only)

## Testing

Run unit tests:

```bash
cd headplane
pnpm test:unit
```

## Security Notes

- The encryption secret should be at least 32 characters long
- Store the encryption secret securely (environment variable or secrets manager)
- Never commit the encryption secret to version control
- Rotate the encryption secret periodically
- Backup the database before rotating the encryption secret

## Future Enhancements

- Connection testing for instances
- Instance health monitoring
- Bulk operations across multiple instances
- Instance groups/tagging
- Import/export instance configurations
