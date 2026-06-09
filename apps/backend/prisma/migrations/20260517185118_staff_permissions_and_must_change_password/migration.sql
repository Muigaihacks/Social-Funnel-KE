-- AlterTable
ALTER TABLE "staff_roles" ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permission_catalog_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;
