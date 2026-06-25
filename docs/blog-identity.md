# What Is This Blog?

Analysis of all published and draft posts in `apps/blog/src/content/blog/`.

---

## Posts Analyzed

| Title                                                        | Status        | Categories                                      |
| ------------------------------------------------------------ | ------------- | ----------------------------------------------- |
| Hot Tip - Don't use Windows for a Dev Environment            | published     | DevOps, Web Development                         |
| Build a Clean React + Express Stack From Scratch             | published     | Web Development, React, Node.js, Express        |
| Expose Your Raspberry Pi to the Internet with Duck DNS       | published     | DNS, Docker, Raspberry Pi, Homelab              |
| A New Beginning - Establishing a Non-Prod Cluster at Home    | published     | DevOps, Web Development, k8s, Proxmox, Strategy |
| Non-Prod Journey Milestone 1 - Proxmox + Terraform + Ansible | published     | Proxmox, k8s, Ansible, Terraform, DevOps        |
| The Prompt Engineering Shortcut (AI image generation)        | published     | AI, Web Development                             |
| Non-Prod Journey Milestone 2 - New Ingress Pattern           | draft         | k8s, DevOps, Flux, terraform, haproxy           |
| Using the React Context API                                  | draft (empty) | Web Development, React                          |

---

## Core Themes

### 1. Homelab Infrastructure — the dominant thread

The deepest, most sustained content is the homelab series: Proxmox virtualization, bare-metal Kubernetes via kubeadm, GitOps with Flux, Ansible playbooks, Terraform for VM lifecycle, HAProxy, Istio, cert-manager, Longhorn storage, and dynamic DNS with Duck DNS on Raspberry Pi. This is not abstract architecture talk — it's working infrastructure at home, built piece by piece over time, with real consequences when things break (one post took down home internet mid-session).

### 2. Web Development Fundamentals

A counterpoint to the homelab depth: accessible tutorials for developers earlier in their journey. React + Express wiring, WSL setup on Windows, React context API (in progress). These posts are more structured and teaching-oriented, include checkpoints and TransparentPanel callouts, and were partly motivated by helping specific people the author knows (his friend Nissa appears in two posts).

### 3. AI as a Tool in the Workflow

AI appears as a tool used in the actual work being documented — not the subject itself. LLMs were used to generate Istio HelmRelease migrations from an existing ingress-nginx config, and to generate AI image prompt templates for blog banners. The AI posts are about process and iteration, not theory.

### 4. Series Format

The non-prod cluster is a multi-post series with explicit milestones: strategy → Proxmox/Terraform/Ansible → ingress pattern → (continuing). Each installment references the previous one and sets up the next. This is a significant part of the site's identity: readers are invited to follow an ongoing project over time.

---

## Writing Style Patterns

### Journey format, not documentation

Every post traces a path from problem → exploration → wrong turns → realization → solution → reflection. The reader isn't handed an answer; they're walked through how the author arrived at it. From "Non-Prod Milestone 1":

> _"I went heads-down and after a few hours of trying to convert proxmox code in my journal to terraform, I came to the following realization..."_

### Mistakes are included, not edited out

- Accidentally broke home internet by changing Eero DHCP settings without understanding all the implications — left in the post with full detail
- Terraform for template management: tried it, realized it was wrong, pivoted to Ansible + golden image approach
- The WSL post mentions a "common pitfall" the author personally experienced

### Honest reflection sections

Every published post ends with a "Reflection" section. These are genuinely introspective — not just summary paragraphs. They acknowledge what went wrong, what the author learned, and what they'd approach differently. They often zoom out to a broader principle ("this is exactly why I'm building a non-prod cluster — I love to tinker even if things break").

### Personal context and real people

Posts are grounded in specific situations: helping a friend (Nissa) learn React, kids waiting for morning TV shows while the internet was down, calling Eero support for 30+ minutes. The homelab isn't abstract — it's a house in Saint Paul with a Banana Pi load balancer and a specific IP subnet range.

### Conversational, not academic

- Uses "you" and "we" to address readers
- Phrases like "Wahoo!", "Let's take a look", "Fun story", "YES!!!"
- Links to favorite documentation with personal endorsements ("I love this page, I've referenced it dozens of times")
- Memes (node_modules meme embedded in WSL post)

### "Show your work" transparency

Posts link directly to the GitHub repos being discussed (home-playbooks, home-kubernetes), include actual shell scripts, Terraform variables, Ansible playbook structures, and Kubernetes manifests. The code shown is the real code.

---

## Audience Signal

- **Primary**: engineers with some experience who want to see how someone else thinks through problems, not just the final answer
- **Secondary**: developers earlier in their career encountering common pitfalls for the first time (WSL, React/Express wiring)
- **Not**: enterprise architects, academic researchers, or people looking for vendor-neutral best practices abstractions

---

## What Makes This Blog Distinctive

1. **The mistakes stay in.** Most technical blogs present polished retrospectives. Here, the wrong turns are documented as they happened.
2. **Series continuity.** The non-prod cluster series invites readers to follow an ongoing homelab project over months, not just consume standalone posts.
3. **Real stakes.** This is a person's actual home network, actual kids, actual Kubernetes cluster that serves real apps. The stakes make the stories land differently than sandbox tutorials.
4. **Dual register.** The blog operates in two registers simultaneously: deep infrastructure (Proxmox, Istio, Flux, Longhorn) and approachable fundamentals (React hooks, WSL setup). These aren't in tension; they reflect the same person at different layers of the stack.
5. **Philosophy mixed in.** The strategy post ("A New Beginning") is largely about how to approach any big, daunting project. The homelab is the vehicle; the message is broader.

---

## Suggested Panel Copy for WelcomeSection

### What this site is

Abbottland.io is a personal engineering journal. Posts trace the arc of a problem from confusion to clarity: building a Kubernetes cluster from bare metal, walking a friend through connecting React to an API, or figuring out why my home internet went down mid-project. I write about what I actually built, including the strategies that changed mid-way and the tools that didn't work out.

### What you'll find here

Homelab deep dives (Proxmox, Kubernetes, Ansible, Terraform), web development walkthroughs, and the occasional AI experiment, often as a series where each post picks up where the last one left off. The goal is less "follow these steps" and more "here's how I thought through it, what broke, and what I learned."

### Notes on voice/framing

- No em-dashes (font incompatibility). Use colons, semicolons, commas, or split sentences.
- The React + Express post is a beginner tutorial written to help a friend learn, not Brandon's first time doing it. Refer to it as "walking a friend through X" not "wiring up React for the first time."
- Keep copy conversational and specific. Concrete details ("my home internet went down mid-project") land better than abstract claims ("I document my journey").
