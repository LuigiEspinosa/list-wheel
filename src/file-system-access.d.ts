interface Window {
  showOpenFilePicker(options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept?: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
  }): Promise<FileSystemFileHandle[]>;
}

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}
