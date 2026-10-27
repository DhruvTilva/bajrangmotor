// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS DETAILS — the single place to edit contact info, hours and links.
// Values are injected into index.html at build time ({{tokens}}) and read by JS.
//
// `verified` notes where each detail came from, so it's clear what still needs
// confirming with the owner before going live.
// ─────────────────────────────────────────────────────────────────────────────

const phones = [
  // Verified: painted on the roadside signboard (image/1maingate.jpg) and on the previous site.
  { display: '+91 98259 52459', tel: '+919825952459' },
  { display: '+91 99091 90316', tel: '+919909190316' },
];

const mapsQuery = encodeURIComponent('Bajrang Motors, Hindorna Chokdi, Rajula, Gujarat 365560');
// Exact pin of the Google Maps listing (taken from the map embed used on the previous site).
const mapPin = '21.017625,71.4359626';

export const business = {
  name: 'Bajrang Motors',
  nameGujarati: 'બજરંગ મોટર્સ',

  // Provided by the owner. Shown in the hero badge, the garage section and the footer.
  legacy: {
    years: 25, // shown as "25+"
    tagline: "Rajula's oldest & most trusted garage",
  },

  address: {
    street: 'Hindorna Chokdi',
    landmark: 'Opposite Balkrishna School',
    city: 'Rajula',
    state: 'Gujarat',
    pin: '365560', // from the previous site
    // Short location line shown in the hero and on the map.
    area: 'Hindorna Road, Rajula',
  },

  phone: phones[0],
  phoneAlt: phones[1],

  // From the previous site — confirm the inbox is still monitored.
  email: 'bajrangmotors5046@gmail.com',

  // Leave empty until the owner confirms which number (if any) is on WhatsApp.
  // Format: country code + number, digits only, e.g. '919825952459'.
  // When set, every "WhatsApp" button on the site appears automatically.
  whatsapp: '',

  hours: {
    // Weekday timings from the previous site; Sunday confirmed by the owner.
    days: 'Monday – Saturday',
    time: '8:00 am – 8:00 pm',
    sunday: 'Sunday half day',
  },

  links: {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${mapPin}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.388319481784!2d71.43310661338731!3d21.01714289355416!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be24561b9f1872b%3A0x3992109ef3d64f01!2sBAJRANG%20MOTORS!5e0!3m2!1sen!2sin!4v1655902915766!5m2!1sen!2sin',
    justdial:
      'https://www.justdial.com/Rajula/Bajrang-Motors-Opposite-Balkrishna-School-Hindorna/9999P2792-2792-220402174139-A9B8_BZDET',
    facebook: 'https://www.facebook.com/profile.php?id=100064946431542',
    // Hosted enquiry form from the previous site (formsubmit.co).
    enquiryForm: 'https://formsubmit.co/el/jafuta',
  },

  developer: { name: 'Byte Crafter', url: 'https://www.github.com/DhruvTilva' },
};

export const whatsappUrl = business.whatsapp
  ? `https://wa.me/${business.whatsapp}?text=${encodeURIComponent('Hello Bajrang Motors, I would like to ask about my car.')}`
  : '';

export const hoursNote = `${business.hours.sunday} · please call ahead`;
