import { buildPermissions } from "../useRolePermissions";

describe("buildPermissions: Super Admin solo por rol explícito", () => {
    test("un Administrador de sede sin sede resuelta NO es Super Admin", () => {
        const p = buildPermissions("admin", null, ["Administrador"]);
        expect(p.isSuperAdmin).toBe(false);
        expect(p.canManageSchools).toBe(false);
        expect(p.canManageRoles).toBe(false);
        expect(p.visibleTabs).not.toContain("schools");
        expect(p.visibleTabs).not.toContain("roles");
        expect(p.visibleTabs).toContain("environments");
    });

    test("un Administrador con sede tampoco", () => {
        const p = buildPermissions("admin", 3, ["Administrador"]);
        expect(p.isSuperAdmin).toBe(false);
        expect(p.visibleTabs).not.toContain("schools");
    });

    test.each(["Super Administrador", "SUPER_ADMIN"])("%s sí gestiona escuelas", (name) => {
        const p = buildPermissions("admin", null, [name]);
        expect(p.isSuperAdmin).toBe(true);
        expect(p.canManageSchools).toBe(true);
        expect(p.visibleTabs).toContain("schools");
    });
});
