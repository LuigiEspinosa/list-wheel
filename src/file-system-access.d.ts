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
