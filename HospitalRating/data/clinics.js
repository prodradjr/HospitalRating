// Directory of places. Addresses/phones checked on official sites 2026-10-31
// except where verified === false (site blocked automated checks).
// Equipment status is "unknown" everywhere: none of these places publish
// accessibility equipment details. We do NOT invent claims.
(function () {
  var ITEMS = ["adjustable_table", "wheelchair_scale", "patient_lift",
    "accessible_restroom", "step_free_entrance", "staff_help"];
  // Extra items that only apply to some specialties.
  var SPECIALTY_ITEMS = { imaging: ["accessible_mammography"] };

  function itemsFor(place) {
    return ITEMS.concat((place && SPECIALTY_ITEMS[place.specialty]) || []);
  }

  // type: "hospital" | "urgent_care" | "specialist"; specialty: null or a SPECIALTIES key
  var list = [
    // ---- hospitals ----
    { id: "emory-uh", type: "hospital", specialty: null, name: "Emory University Hospital", address: "1364 Clifton Rd NE, Atlanta, GA 30322", phone: "404-712-2000", verified: true },
    { id: "emory-decatur", type: "hospital", specialty: null, name: "Emory Decatur Hospital", address: "2701 N Decatur Rd, Decatur, GA 30033", phone: "404-501-1000", verified: true },
    { id: "emory-johns-creek", type: "hospital", specialty: null, name: "Emory Johns Creek Hospital", address: "6325 Hospital Pkwy, Johns Creek, GA 30097", phone: "678-474-7000", verified: true },
    { id: "piedmont-atlanta", type: "hospital", specialty: null, name: "Piedmont Atlanta Hospital", address: "1968 Peachtree Rd NW, Atlanta, GA 30309", phone: "404-605-5000", verified: true },
    { id: "piedmont-eastside", type: "hospital", specialty: null, name: "Piedmont Eastside Medical Center", address: "1700 Medical Way, Snellville, GA 30078", phone: "770-979-0200", verified: true },
    { id: "grady", type: "hospital", specialty: null, name: "Grady Memorial Hospital", address: "80 Jesse Hill Jr Dr SE, Atlanta, GA 30303", phone: "404-616-1000", verified: true },
    { id: "northside-gwinnett", type: "hospital", specialty: null, name: "Northside Hospital Gwinnett", address: "1000 Medical Center Blvd, Lawrenceville, GA 30046", phone: "678-312-1000", verified: false },
    { id: "northside-atlanta", type: "hospital", specialty: null, name: "Northside Hospital Atlanta", address: "1000 Johnson Ferry Rd NE, Atlanta, GA 30342", phone: "404-851-8000", verified: false }

    // ---- urgent care ----
    ,
    // Emory's urgent care network is Peachtree Immediate Care (peachtreemed.com)
    { id: "pic-lawrenceville", type: "urgent_care", specialty: null, name: "Peachtree Immediate Care – Lawrenceville (Emory)", address: "455 Grayson Hwy Ste 105A, Lawrenceville, GA 30045", phone: "770-963-0927", verified: true },
    { id: "pic-duluth", type: "urgent_care", specialty: null, name: "Peachtree Immediate Care – Duluth (Emory)", address: "3551 Satellite Blvd, Duluth, GA 30096", phone: "770-476-3000", verified: true },
    { id: "pic-snellville", type: "urgent_care", specialty: null, name: "Peachtree Immediate Care – Snellville (Emory)", address: "3991 Stone Mountain Hwy, Snellville, GA 30039", phone: "678-786-8677", verified: true },
    { id: "puc-lawrenceville", type: "urgent_care", specialty: null, name: "Piedmont Urgent Care – Lawrenceville", address: "3330 Sugarloaf Pkwy Ste A, Lawrenceville, GA 30044", phone: "404-480-9797", verified: true },
    { id: "puc-duluth", type: "urgent_care", specialty: null, name: "Piedmont Urgent Care – Duluth Pleasant Hill", address: "1605 Pleasant Hill Rd, Duluth, GA 30096", phone: "770-884-4200", verified: true },
    { id: "puc-suwanee", type: "urgent_care", specialty: null, name: "Piedmont Urgent Care – Suwanee", address: "2637 Peachtree Pkwy, Suwanee, GA 30024", phone: "470-523-9080", verified: true },
    { id: "puc-lilburn", type: "urgent_care", specialty: null, name: "Piedmont Urgent Care – Lilburn", address: "976 Killian Hill Rd SW Ste A, Lilburn, GA 30047", phone: "770-752-4142", verified: true }

    // ---- specialists ----
    ,
    { id: "piedmont-ent-atlanta", type: "specialist", specialty: "ent", name: "Piedmont Physicians ENT Atlanta", address: "2001 Peachtree Rd NE Ste 650, Atlanta, GA 30309", phone: "404-253-3655", verified: true },
    { id: "piedmont-head-neck", type: "specialist", specialty: "ent", name: "Piedmont Physicians Head and Neck Surgery Atlanta", address: "1800 Howell Mill Rd Ste 300, Atlanta, GA 30318", phone: "404-605-1155", verified: true },
    { id: "piedmont-heart-institute", type: "specialist", specialty: "cardiology", name: "Piedmont Heart Institute", address: "1968 Peachtree Rd NW, Atlanta, GA 30309", phone: "404-605-2800", verified: true },
    { id: "piedmont-heart-buckhead", type: "specialist", specialty: "cardiology", name: "Piedmont Heart of Buckhead", address: "275 Collier Rd NW Ste 500, Atlanta, GA 30309", phone: "404-605-2800", verified: true },
    // Emory ortho pages list only the central appointment line
    { id: "emory-ortho-brookhaven", type: "specialist", specialty: "orthopedics", name: "Emory Orthopaedics & Spine Center – Brookhaven", address: "21 Ortho Ln, Atlanta, GA 30329", phone: "404-778-3350", verified: true },
    { id: "emory-ortho-johns-creek", type: "specialist", specialty: "orthopedics", name: "Emory Orthopaedics & Spine Center – Johns Creek", address: "6335 Hospital Pkwy Ste 400, Johns Creek, GA 30097", phone: "404-778-3350", verified: true },
    { id: "piedmont-shaheen-breast", type: "specialist", specialty: "imaging", name: "Doris Shaheen Breast Health Center at Piedmont Atlanta", address: "1968 Peachtree Rd NW, Atlanta, GA 30309", phone: "404-605-4400", verified: true },
    // phone confirmed on emoryhealthcare.org; street address not shown there
    { id: "emory-glenn-breast", type: "specialist", specialty: "imaging", name: "Emory Glenn Family Breast Center", address: "1365-C Clifton Rd NE, Atlanta, GA 30322", phone: "404-778-3307", verified: false }
  ];

  list.forEach(function (c) {
    c.equipment = {};
    itemsFor(c).forEach(function (k) { c.equipment[k] = { status: "unknown", source: null }; });
    // "..., Atlanta, GA 30322" -> city "Atlanta", zip "30322"
    var m = c.address.match(/,\s*([^,]+),\s*GA\s*(\d{5})/);
    c.city = m ? m[1] : "";
    c.zip = m ? m[2] : "";
  });

  window.ITEMS = ITEMS;
  window.ALL_ITEMS = ITEMS.concat(["accessible_mammography"]);
  window.itemsFor = itemsFor;
  window.ITEM_LABELS = {
    adjustable_table: "Height-adjustable exam table",
    wheelchair_scale: "Wheelchair-accessible scale",
    patient_lift: "Patient lift / transfer help",
    accessible_restroom: "Accessible restroom",
    step_free_entrance: "Step-free entrance",
    staff_help: "Staff trained to help",
    accessible_mammography: "Accessible mammography (seated)",
    other: "Other (not equipment)"
  };
  window.ITEM_ICONS = {
    adjustable_table: "🛏️", wheelchair_scale: "⚖️", patient_lift: "🏗️",
    accessible_restroom: "🚻", step_free_entrance: "🚪", staff_help: "🧑‍⚕️",
    accessible_mammography: "🩻", other: "💬"
  };
  window.PLACE_TYPES = {
    hospital: { label: "Hospitals", one: "hospital", many: "hospitals", icon: "🏥" },
    urgent_care: { label: "Urgent Care", one: "urgent care center", many: "urgent care centers", icon: "🚑" },
    specialist: { label: "Specialists", one: "clinic", many: "specialist clinics", icon: "🩺" }
  };
  window.SPECIALTIES = {
    ent: { label: "ENT (ear, nose, throat)", icon: "👂" },
    cardiology: { label: "Cardiology (heart)", icon: "❤️" },
    orthopedics: { label: "Orthopedics (bones, joints)", icon: "🦴" },
    imaging: { label: "Imaging & Mammography", icon: "🩻" }
  };
  window.CLINICS = list;
})();
