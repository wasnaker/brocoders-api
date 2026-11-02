---
inject: true
to: src/app.module.ts
after: HYGEN_MODULE_IMPORTS
---
    <%= h.inflection.transform(name, ['pluralize']) %>Module,