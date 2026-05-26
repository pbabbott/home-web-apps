import nonProdCluster01 from './blog-non-prod-cluster-01.json';
import nonProdCluster02 from './blog-non-prod-cluster-02.json';
import duckDns01 from './blog-duck-dns-01.json';
import duckDns02 from './blog-duck-dns-02.json';
import duckDns03 from './blog-duck-dns-03.json';
import examplePost from './blog-example-post.json';
import nonProdMilestoneOne from './blog-non-prod-milestone-one-proxmox-terraform-ansible.json';
import wslDevEnvironment from './blog-wsl-development-environment.json';

export interface DiagramEntry {
  id: string;
  label: string;
  blogPost: string;
  data: { nodes: unknown[]; edges: unknown[] };
}

export const diagrams: DiagramEntry[] = [
  {
    id: 'blog-non-prod-cluster-01',
    label: 'Non-Prod Cluster (1 of 2)',
    blogPost: 'a-new-beginning-establishing-a-non-prod-cluster-at-home',
    data: nonProdCluster01 as DiagramEntry['data'],
  },
  {
    id: 'blog-non-prod-cluster-02',
    label: 'Non-Prod Cluster (2 of 2)',
    blogPost: 'a-new-beginning-establishing-a-non-prod-cluster-at-home',
    data: nonProdCluster02 as DiagramEntry['data'],
  },
  {
    id: 'blog-duck-dns-01',
    label: 'Duck DNS (1 of 3)',
    blogPost: 'duck-dns-on-raspberry-pi',
    data: duckDns01 as DiagramEntry['data'],
  },
  {
    id: 'blog-duck-dns-02',
    label: 'Duck DNS (2 of 3)',
    blogPost: 'duck-dns-on-raspberry-pi',
    data: duckDns02 as DiagramEntry['data'],
  },
  {
    id: 'blog-duck-dns-03',
    label: 'Duck DNS (3 of 3)',
    blogPost: 'duck-dns-on-raspberry-pi',
    data: duckDns03 as DiagramEntry['data'],
  },
  {
    id: 'blog-example-post',
    label: 'Example Post',
    blogPost: 'example-post',
    data: examplePost as DiagramEntry['data'],
  },
  {
    id: 'blog-non-prod-milestone-one-proxmox-terraform-ansible',
    label: 'Non-Prod Milestone One – Proxmox / Terraform / Ansible',
    blogPost: 'non-prod-milestone-one-proxmox-terraform-ansible',
    data: nonProdMilestoneOne as DiagramEntry['data'],
  },
  {
    id: 'blog-wsl-development-environment',
    label: 'WSL Development Environment',
    blogPost: 'wsl-development-environment',
    data: wslDevEnvironment as DiagramEntry['data'],
  },
];
