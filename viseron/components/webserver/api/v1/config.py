"""Config API Handler."""
import json
import logging
from http import HTTPStatus
from typing import Any

from ruamel.yaml import YAML, YAMLError
from ruamel.yaml.scalarstring import ScalarString

from viseron.components.webserver.api.handlers import BaseAPIHandler
from viseron.components.webserver.auth import Role
from viseron.const import CONFIG_PATH

LOGGER = logging.getLogger(__name__)

# Components whose global config can be read/written via this API
ALLOWED_COMPONENTS = {"logger", "storage", "webserver"}


def _sanitize_yaml_objects(obj: Any) -> Any:
    """Convert ruamel.yaml objects to standard Python types."""
    if isinstance(obj, dict):
        return {k: _sanitize_yaml_objects(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_yaml_objects(item) for item in obj]
    if isinstance(obj, ScalarString):
        return str(obj)
    if hasattr(obj, "value"):
        return str(obj.value)
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    return str(obj)


class ConfigAPIHandler(BaseAPIHandler):
    """Handler for API calls related to config."""

    routes = [
        {
            "requires_role": [Role.ADMIN],
            "path_pattern": r"/config",
            "supported_methods": ["GET"],
            "method": "get_config",
        },
        {
            "requires_role": [Role.ADMIN],
            "path_pattern": r"/config/(?P<component>[a-z_]+)",
            "supported_methods": ["GET"],
            "method": "get_component_config",
        },
        {
            "requires_role": [Role.ADMIN],
            "path_pattern": r"/config/(?P<component>[a-z_]+)",
            "supported_methods": ["PUT"],
            "method": "update_component_config",
        },
    ]

    def _load_yaml(self) -> dict[str, Any]:
        yaml = YAML(typ="rt")
        yaml.preserve_quotes = True
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return yaml.load(f) or {}

    def _save_yaml(self, config: dict[str, Any]) -> None:
        yaml = YAML(typ="rt")
        yaml.preserve_quotes = True
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.dump(config, f)

    async def get_config(self) -> None:
        """Return Viseron config as raw text."""

        def read_config() -> str:
            with open(CONFIG_PATH, encoding="utf-8") as config_file:
                return config_file.read()

        config = await self.run_in_executor(read_config)
        await self.response_success(response=config)

    async def get_component_config(self, component: str) -> None:
        """Return config for a single top-level component section."""
        if component not in ALLOWED_COMPONENTS:
            self.response_error(
                status_code=HTTPStatus.BAD_REQUEST,
                reason=f"Component '{component}' is not supported. "
                f"Allowed: {sorted(ALLOWED_COMPONENTS)}",
            )
            return

        def _read() -> dict[str, Any]:
            config = self._load_yaml()
            section = config.get(component, {}) or {}
            return _sanitize_yaml_objects(dict(section))

        result = await self.run_in_executor(_read)
        await self.response_success(response=result)

    async def update_component_config(self, component: str) -> None:
        """Update a single top-level component section in config.yaml."""
        if component not in ALLOWED_COMPONENTS:
            self.response_error(
                status_code=HTTPStatus.BAD_REQUEST,
                reason=f"Component '{component}' is not supported. "
                f"Allowed: {sorted(ALLOWED_COMPONENTS)}",
            )
            return

        try:
            request_data = json.loads(self.request.body)
        except json.JSONDecodeError as e:
            self.response_error(
                status_code=HTTPStatus.BAD_REQUEST,
                reason=f"Invalid JSON: {e}",
            )
            return

        def _write() -> None:
            config = self._load_yaml()
            config[component] = request_data
            self._save_yaml(config)

        try:
            await self.run_in_executor(_write)
            await self.response_success(
                response={"message": f"'{component}' configuration updated successfully"}
            )
        except (OSError, YAMLError) as e:
            LOGGER.error("Error updating component config: %s", e, exc_info=True)
            self.response_error(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                reason=f"Failed to update configuration: {e}",
            )
