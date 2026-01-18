import { useGitHubContext } from '@/contexts/GitHubContext';

export const useGitHub = () => {
  return useGitHubContext();
};
