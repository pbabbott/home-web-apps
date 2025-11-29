'use client';

import { Panel, Typography } from '@abbottland/fui-components';
import Image from 'next/image';

export default function AboutMeSection() {
  return (
    <div className="bg-neutral-900 w-full flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-screen-lg">
        <div className="grid grid-cols-2 gap-8 mb-4">
          <Panel color="primary" className="flex-shrink-0 py-4">
            <Image
              src="/home/brandon_abbott_profile_picture.jpg"
              alt="Brandon Abbott Profile Picture"
              sizes="100vw"
              className="object-contain"
              fill
            />
          </Panel>
          <div>
            <Typography
              variant="h3"
              component="h3"
              className="mb-4 uppercase text-center"
            >
              About Me
            </Typography>
            <Typography variant="body1" component="p" className="mb-4">
              I am a software engineer based in Saint Paul, MN, with a passion
              for writing efficient code and fostering team success. With over a
              decade of professional experience since 2010, I specialize in
              designing robust architectures, implementing DevOps best
              practices, and continuously improving my skills. I have a strong
              commitment to writing high-quality code and collaborating with
              others to achieve optimal results.
            </Typography>
            <Typography variant="body1" component="p" className="mb-4">
              Outside of work, I maintain a small homelab to practice and
              explore new technologies. I&#39;ve been using Ansible to manage my
              infrastructure via the repository{' '}
              <a
                href="https://github.com/pbabbott/home-playbooks"
                target="_blank"
                rel="noopener noreferrer"
              >
                home-playbooks
              </a>{' '}
              and Flux to manage my GitOps configuration via the repository{' '}
              <a
                href="https://github.com/pbabbott/home-kubernetes"
                target="_blank"
                rel="noopener noreferrer"
              >
                home-kubernetes
              </a>
              . Within this infrastructure and among these hosted services, I
              have deployed custom web applications which are managed by the
              monorepo:{' '}
              <a
                href="https://github.com/pbabbott/home-web-apps"
                target="_blank"
                rel="noopener noreferrer"
              >
                home-web-apps
              </a>
              . These experiences have not only improved my technical skills but
              also taught me valuable lessons in project management and system
              scalability.
            </Typography>
          </div>
        </div>
        <div>
          <Typography variant="body1" component="p" className="mb-4">
            When I&#39;m not at the keyboard, I enjoy connecting with family,
            playing video games, and cooking. I moved back home to Seattle with
            my wife Marie in 2016 to be closer to my family and then to Saint
            Paul, MN, in 2023 to live closer to Marie&#39;s family after having
            two children. In my free time, I love playing factory-simulation
            games like Satisfactory, Factorio, & Dyson Sphere Program, which
            fuel my creativity and problem-solving skills. I also enjoy shooters
            like Call of Duty, Halo, & Battlefield, to stay connected with my
            hometown friends. Cooking Mexican and Korean cuisine is another
            passion of mine, as I find joy in sharing great food and connecting
            with others. At my groom&#39;s party just before my wedding, I
            cooked a Mexican feast for nearly 35 guests - a memorable experience
            that highlights my love for both cooking and bringing people
            together.
          </Typography>
          <Typography variant="body1" component="p" className="mb-4">
            As you read through this blog, you&#39;ll see that I value my craft
            as a software engineer as it allows me to bring out my creative
            side. It is my hope that you might find inspiration in doing the
            same with your own practice or profession as you explore the content
            of this website.
          </Typography>
        </div>
      </div>
    </div>
  );
}
