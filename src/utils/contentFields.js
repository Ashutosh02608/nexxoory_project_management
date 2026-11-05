const projectFields = [
  'projectType',
  'deliverySchedule',
  'clientName',
  'contractStart',
  'contractEnd',
  'postTarget',
  'reelTarget',
  'aiReelTarget',
  'serviceTarget',
  'oneTimeTarget',
  'brief',
  'internalNotes'
];

const taskFields = [
  'contentType',
  'deliveryCategory',
  'designStatus',
  'designDate',
  'approvalStatus',
  'feedback',
  'postDate',
  'postStatus',
  'publishedDate'
];

export const editableContent = (value = {}, project = false) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => (project ? projectFields : taskFields).includes(key)));
