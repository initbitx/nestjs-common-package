export interface IStandardResponseModuleOptions {
  interceptAll?: boolean;
  validateResponse?: (data) => boolean;
  validationErrorMessage?: string;
}
