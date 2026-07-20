# Pendiente: Fix Sidebar no refleja permisos asignados

**Fecha**: 09/07/2026
**Estado**: Pendiente de implementar

## Problema

Al asignar permisos a un rol en Configuracion > Roles / Permisos, los cambios no se reflejan en el sidebar del usuario que tiene ese rol. El usuario sigue viendo todos los modulos o los modulos incorrectos.

## Causa raiz

El JWT (token de sesion) almacena los `roles` del usuario al momento del login y **nunca se actualiza** aunque los permisos/roles cambien en la base de datos.

### Flujo actual (con bug)

1. Usuario hace login → JWT guarda `roles: ["OPERADOR"]`, `superAdmin: false`
2. Admin modifica permisos del rol "OPERADOR" en Configuracion
3. El usuario navega → layout.tsx:35 ejecuta `roles.includes("ADMIN")` con el **JWT viejo**
4. Como no es ADMIN, llama `obtenerModulosPermitidos()` que consulta la DB → esto **si funciona**
5. **PERO**: si el usuario originalmente tenia rol ADMIN y se lo quitaron, el JWT todavia dice `roles: ["ADMIN"]` → bypass activo → ve todo

### Segundo problema: cache de layout

`revalidatePath("/configuracion")` se ejecuta al guardar permisos, pero **NO** se ejecuta `revalidatePath("/")`. El layout del dashboard (donde vive el sidebar) podria quedar cacheado con datos viejos.

## Cambios a implementar

### 1. Refrescar roles en el JWT (`src/lib/auth.ts`)

En el callback `jwt`, bloque `if (trigger === "update")` (linea ~94), agregar refresh de roles desde la DB:

```typescript
// Dentro del bloque if (trigger === "update") despues de lineas 99-103
const usuarioRoles = await prisma.usuarioRol.findMany({
  where: { usuarioId: userId },
  include: { rol: { select: { nombre: true } } },
})
token.roles = usuarioRoles.map((ur) => ur.rol.nombre)
```

### 2. Agregar revalidatePath("/") en server actions (`src/actions/configuracion.ts`)

En `updateRolPermisos` (linea ~378), despues de `revalidatePath("/configuracion")`:

```typescript
revalidatePath("/")
```

En `assignRolToUser` (linea ~399), despues de `revalidatePath("/configuracion")`:

```typescript
revalidatePath("/")
```

En `removeRolFromUser` (linea ~410), despues de `revalidatePath("/configuracion")`:

```typescript
revalidatePath("/")
```

### 3. Verificar

- Build exitoso: `npm run build`
- Probar flujo completo:
  1. Crear usuario nuevo (no admin)
  2. Crear rol con permisos limitados (ej: solo COMPRAS lectura)
  3. Asignar rol al usuario
  4. Login con ese usuario → sidebar debe mostrar solo Compras
  5. Agregar permisos de VENTAS al rol
  6. Login de nuevo con ese usuario → sidebar debe mostrar Compras + Ventas

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/auth.ts` | Agregar refresh de `token.roles` en `trigger === "update"` |
| `src/actions/configuracion.ts` | Agregar `revalidatePath("/")` en `updateRolPermisos`, `assignRolToUser`, `removeRolFromUser` |
