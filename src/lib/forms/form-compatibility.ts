/**
 * Transparent Legacy Normalization & Backward-Compatibility Adapter
 * 
 * Adapts legacy Forms 1.0 documents (with flat fields: FormFieldInstance[])
 * into modern Forms 2.0 FormVersion structures (pages -> components -> fields)
 * so that all historical forms, embeds, and public URLs continue to work flawlessly.
 */

import type { Form, FormFieldInstance, AppField } from '@/lib/types';
import type { 
  FormVersion, 
  FormPage, 
  FormComponent, 
  FormField, 
  FieldSemanticType,
  FormComponentType,
} from './form-types';

/**
 * Maps legacy AppField/FormFieldInstance type strings into canonical FieldSemanticType
 */
export function mapLegacyTypeToSemantic(type?: string): FieldSemanticType {
  switch (type) {
    case 'long_text':
    case 'textarea':
      return 'textarea';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'number':
    case 'currency':
      return 'number';
    case 'date':
      return 'date';
    case 'time':
    case 'datetime':
      return 'datetime';
    case 'select':
      return 'select';
    case 'multi_select':
      return 'multi_select';
    case 'radio':
    case 'yes_no':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    case 'address':
      return 'address';
    case 'url':
    case 'link':
      return 'url';
    case 'hidden':
      return 'hidden';
    case 'rating':
      return 'rating';
    case 'file':
      return 'file';
    case 'signature':
      return 'signature';
    case 'consent':
      return 'consent';
    default:
      return 'text';
  }
}

/**
 * Converts a legacy FormFieldInstance into a Forms 2.0 FormComponent
 */
export function convertInstanceToComponent(
  instance: FormFieldInstance, 
  appField?: AppField
): FormComponent {
  const semanticType = mapLegacyTypeToSemantic(appField?.type);

  const field: FormField = {
    id: instance.id,
    appFieldId: instance.appFieldId,
    semanticType,
    label: instance.labelOverride || appField?.label || instance.appFieldId || 'Field',
    placeholder: instance.placeholderOverride || appField?.placeholder,
    helpText: instance.helpTextOverride || appField?.helpText,
    required: !!instance.required,
    hidden: !!instance.hidden,
    defaultValue: instance.defaultValueOverride,
    options: appField?.options?.map(opt => ({
      label: typeof opt === 'string' ? opt : opt.label,
      value: typeof opt === 'string' ? opt : opt.value,
    })),
  };

  return {
    id: `comp_${instance.id}`,
    type: 'field',
    order: instance.order || 0,
    fieldId: instance.id,
    field,
    layout: {
      width: instance.width === 'half' ? 'half' : 'full',
      alignment: 'left',
    },
  };
}

/**
 * Normalizes any Form document into a Forms 2.0 FormVersion.
 * If the form already has versioning, it returns the active version;
 * otherwise it synthesizes a single-page FormVersion from the legacy fields array.
 */
export function normalizeFormToVersion(
  form: Form, 
  appFieldsMap?: Record<string, AppField>
): FormVersion {
  // If modern version structure is present in the form document
  if (form.currentVersion) {
    return form.currentVersion;
  }

  // If multi-page structure is present on the form draft
  if (form.pages && form.pages.length > 0) {
    return {
      id: `ver_${form.id}_draft`,
      formId: form.id,
      versionNumber: form.version || 1,
      status: form.status === 'published' ? 'published' : 'draft',
      schemaVersion: '2.0',
      pages: form.pages,
      createdAt: form.createdAt || new Date().toISOString(),
      publishedAt: form.publishedAt,
    };
  }

  // Synthesize legacy single-page version
  const rawFields: FormFieldInstance[] = form.fields || [];
  const sortedFields = [...rawFields].sort((a, b) => (a.order || 0) - (b.order || 0));

  const components: FormComponent[] = sortedFields.map(ff => {
    const af = appFieldsMap ? appFieldsMap[ff.appFieldId] : undefined;
    return convertInstanceToComponent(ff, af);
  });

  const page: FormPage = {
    id: 'page_1',
    title: form.title || 'Form Details',
    description: form.description,
    order: 0,
    components,
    progressWeight: 1,
  };

  return {
    id: `ver_${form.id}_legacy`,
    formId: form.id,
    versionNumber: 1,
    status: form.status === 'published' ? 'published' : 'draft',
    schemaVersion: '2.0-compat',
    pages: [page],
    createdAt: form.createdAt || new Date().toISOString(),
    publishedAt: form.publishedAt || (form.status === 'published' ? form.createdAt : undefined),
  };
}
