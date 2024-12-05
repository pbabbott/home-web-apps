/* eslint-disable react/no-unescaped-entities */
import type { Meta, StoryObj } from "@storybook/react";
import { Typography } from "./Typography";

const meta: Meta<typeof Typography> = {
  title: "Data Display/Typography",
  component: Typography,
  argTypes: {
    variant: {
      control: "select",
      options: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "body1",
        "body2",
        "caption",
        "small",
        "button",
      ],
    },
    component: {
      control: "select",
      options: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Typography>;

export const Default: Story = {
  args: {
    variant: "body1",
    component: "p",
    children: "Customizable Typography",
  },
};
export const VariantShowcase: Story = {
  render: () => (
    <div className="flex flex-col space-y-4">
      <Typography variant="h1" component="h1">
        H1 Heading
      </Typography>
      <Typography variant="h2" component="h2">
        H2 Heading
      </Typography>
      <Typography variant="h3" component="h3">
        H3 Heading
      </Typography>
      <Typography variant="h4" component="h4">
        H4 Heading
      </Typography>
      <Typography variant="h5" component="h5">
        H5 Heading
      </Typography>
      <Typography variant="h6" component="h6">
        H6 Heading
      </Typography>
      <Typography variant="body1" component="p">
        Body 1 Paragraph
      </Typography>
      <Typography variant="body2" component="p">
        Body 2 Paragraph
      </Typography>
      <Typography variant="caption" component="span">
        Caption Text
      </Typography>
      <Typography variant="small" component="span">
        Small Text
      </Typography>
      <Typography variant="button" component="span">
        Button Text
      </Typography>
    </div>
  ),
};

export const BlogShowcase: Story = {
  render: () => (
    <div>
      <Typography className="mb-4" component="h1" variant="h1">
        Page title
      </Typography>
      <Typography className="mb-4" component="p" variant="caption">
        This is a neat little tidbit about the page
      </Typography>
      <Typography className="mb-4" component="h2" variant="h2">
        Section 1
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        Letterpress typewriter keffiyeh readymade, flannel plaid af 90's
        meggings. Gorpcore beard authentic yuccie gentrify. Everyday carry
        thundercats listicle subway tile cray pug iceland disrupt marfa neutra.
        Lumbersexual live-edge small batch flannel polaroid gochujang crucifix.
        Put a bird on it asymmetrical gorpcore locavore, hashtag before they
        sold out bitters artisan gentrify listicle messenger bag cronut fit
        keytar. Ramps solarpunk stumptown, banh mi bicycle rights activated
        charcoal disrupt hexagon hammock vice freegan gatekeep blackbird
        spyplane photo booth.
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        Yuccie jean shorts prism pickled photo booth celiac, hell of biodiesel
        taxidermy whatever four loko salvia. 3 wolf moon bruh kitsch cray
        mixtape williamsburg cloud bread. Gochujang DSA jianbing, chillwave
        coloring book marfa tbh palo santo air plant umami poutine mukbang food
        truck pour-over. Street art lumbersexual big mood poke venmo ennui,
        before they sold out austin. Hammock occupy fam vibecession synth,
        selfies taxidermy try-hard.
      </Typography>
      <Typography className="mb-4" component="h2" variant="h2">
        Section 2
      </Typography>
      <Typography className="mb-4" component="p" variant="body1">
        Dummy text? More like dummy thicc text, amirite?
      </Typography>

      <Typography className="mb-4" component="h3" variant="h3">
        Sub-Section A
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        Pabst single-origin coffee you probably haven't heard of them tote bag
        blackbird spyplane. Synth coloring book williamsburg drinking vinegar
        messenger bag DIY bodega boys try-hard hammock man bun tumeric
        single-origin coffee. Readymade polaroid typewriter, chillwave PBR&B
        tonx VHS sustainable yes plz man braid hexagon kitsch. Irony cupping
        pitchfork, truffaut pickled enamel pin artisan brunch lumbersexual deep
        v. You probably haven't heard of them enamel pin chillwave celiac, same
        JOMO poke pug pour-over.
      </Typography>
      <Typography className="mb-4" component="h3" variant="h3">
        Sub-Section B
      </Typography>

      <Typography className="mb-4" component="p" variant="body2">
        I'm baby butcher intelligentsia raclette, bitters gatekeep roof party
        thundercats small batch. Selvage wayfarers yuccie four loko mlkshk
        williamsburg vegan messenger bag slow-carb pitchfork etsy. Pinterest
        organic marxism pickled, letterpress XOXO kale chips church-key
        asymmetrical marfa pug cornhole stumptown. Cloud bread scenester JOMO
        retro microdosing. Ugh irony man braid praxis. Letterpress ugh shabby
        chic mumblecore meh DSA echo park yr offal cray.
      </Typography>
      <Typography className="mb-4" component="h4" variant="h4">
        Sub-Sub-Section B.1
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        Gastropub flannel PBR&B art party. Waistcoat fashion axe af praxis same
        VHS sriracha. Kickstarter put a bird on it typewriter kitsch, you
        probably haven't heard of them kale chips pug bitters unicorn DSA.
        Messenger bag pug bodega boys affogato. Chia gochujang man braid, palo
        santo 3 wolf moon pabst echo park austin hell of chambray portland.
      </Typography>
      <Typography className="mb-4" component="h4" variant="h4">
        Sub-Sub-Section B.2
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        8-bit humblebrag raw denim, lo-fi +1 godard neutra fashion axe. Narwhal
        mukbang pitchfork street art messenger bag. Chillwave drinking vinegar
        humblebrag, raw denim master cleanse tousled sartorial twee gorpcore.
        Normcore 90's mixtape offal, gochujang ascot praxis fanny pack biodiesel
        gatekeep banjo bespoke +1 retro cornhole.
      </Typography>

      <Typography className="mb-4" component="h5" variant="h5">
        Sub-Sub-Sub-Section B.2.1
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        Coloring book cliche bruh, fingerstache iceland mlkshk plaid cloud bread
        lyft snackwave. Fit synth gorpcore before they sold out quinoa ramps
        squid poke. Readymade heirloom tilde stumptown Brooklyn. Sartorial
        occupy lomo hoodie butcher, lumbersexual single-origin coffee literally.
        +1 poke gorpcore chicharrones wolf gluten-free neutral milk hotel
        flannel, wayfarers poutine pabst palo santo sartorial brunch crucifix.
      </Typography>
      <Typography className="mb-4" component="h5" variant="h5">
        Sub-Sub-Sub-Section B.2.2
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        Selfies poutine Brooklyn butcher jianbing hexagon. Four dollar toast fam
        retro gentrify, YOLO master cleanse food truck squid tumeric ennui
        letterpress mlkshk XOXO gluten-free cardigan. Leggings pabst cred
        tousled, blackbird spyplane jawn pork belly venmo pitchfork. Mustache
        portland jianbing, ramps raw denim bitters grailed ennui letterpress
        umami hexagon vegan gatekeep DIY.
      </Typography>
      <Typography className="mb-4" component="h3" variant="h3">
        Sub-Section C
      </Typography>
      <Typography className="mb-4" component="p" variant="body2">
        I'm baby chicharrones marxism shaman schlitz gatekeep meditation
        coloring book pour-over flannel asymmetrical artisan semiotics bushwick
        small batch. Cardigan pok pok thundercats tumeric austin master cleanse.
        Pug shabby chic cred photo booth post-ironic. Single-origin coffee DIY
        etsy same, unicorn vaporware intelligentsia keffiyeh trust fund mustache
        twee tumeric asymmetrical fanny pack. Taxidermy iPhone skateboard yr
        ascot salvia, vegan vaporware keffiyeh intelligentsia chillwave
        biodiesel +1 literally flexitarian.
      </Typography>
      <Typography className="mb-4" component="h2" variant="h2">
        Section 3
      </Typography>
      <Typography className="mb-4" component="p" variant="body1">
        Content coming soon!
      </Typography>
    </div>
  ),
};
